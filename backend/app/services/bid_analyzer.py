import asyncio
import json
import re
from datetime import datetime

from app.services.claude_service import ClaudeService
from app.services.commodity_service import CommodityService
from app.services.subcontractor_service import SubcontractorService
from app.services.vertex_judge_service import VertexJudgeService
from app.db.firestore_client import get_prompt_template


class BidAnalyzer:
    def __init__(self):
        self.claude = ClaudeService()
        self.commodity = CommodityService()
        self.sub_service = SubcontractorService()

    async def analyze_bid(self, bid_data: dict) -> dict:
        document_text = bid_data.get("raw_text", "")
        tables_text = self._format_tables(bid_data.get("raw_tables", []))
        project_type = bid_data.get("project_type", "Commercial")
        location = bid_data.get("location", "")

        # Get commodity data for context
        commodity_data = self.commodity.get_current_prices()
        commodity_trends = self.commodity.get_price_trends()

        # Step 1: Bid Extraction & Analysis
        bid_extraction = await self._run_bid_extraction(
            document_text, tables_text, project_type
        )

        scope_summary = bid_extraction.get("summary", "")
        divisions = json.dumps(bid_extraction.get("divisions", []))

        # Steps 2 & 3: Run in parallel (both depend on Step 1 but not on each other)
        sub_data = await self.sub_service.get_all_subcontractors()
        print(f"[BidAnalyzer] Found {len(sub_data)} subcontractors in database")
        print("[BidAnalyzer] Running Steps 2 & 3 in parallel...")

        material_procurement, sub_scheduling = await asyncio.gather(
            self._run_material_procurement(
                scope_summary, commodity_data, commodity_trends, location
            ),
            self._run_sub_scheduling(
                scope_summary, divisions,
                json.dumps(sub_data),
                "{}"
            ),
        )
        print(f"[BidAnalyzer] sub_scheduling keys: {list(sub_scheduling.keys())}")
        if sub_scheduling.get("parse_error"):
            print(f"[BidAnalyzer] WARNING: sub_scheduling had a parse error")
            # Provide a valid structure so the UI doesn't break
            sub_scheduling = {
                "required_trades": [],
                "matches": [],
                "schedule_notes": ["Error: AI response could not be parsed. Try re-analyzing."],
                "parse_error": True,
            }

        # Step 4: Judge Validation (Llama 4 Maverick via Vertex AI)
        print("[BidAnalyzer] Running judge validation with Llama 4 Maverick...")
        judge_service = VertexJudgeService()
        judge_validation = await judge_service.validate(
            bid_extraction, material_procurement, sub_scheduling, document_text
        )
        print(f"[BidAnalyzer] Judge score: {judge_validation.get('overall_score', 'N/A')}, passed: {judge_validation.get('passed', 'N/A')}")

        # Strip raw_response from all steps before storing (too large for Firestore)
        for step in [bid_extraction, material_procurement, sub_scheduling]:
            step.pop("raw_response", None)

        return {
            "bid_extraction": bid_extraction,
            "material_procurement": material_procurement,
            "sub_scheduling": sub_scheduling,
            "judge_validation": judge_validation,
            "commodity_snapshot": commodity_data,
            "generated_at": datetime.utcnow().isoformat(),
        }

    async def _run_bid_extraction(
        self, document_text: str, tables_text: str, project_type: str
    ) -> dict:
        template = await get_prompt_template("bid_extraction")
        prompt = template["template_text"].format(
            document_text=document_text,
            tables_text=tables_text,
            project_type=project_type,
        )
        raw = await asyncio.to_thread(
            self.claude.generate,
            prompt=prompt,
            max_tokens=template.get("max_tokens", 4096),
        )
        return self._parse_json(raw)

    async def _run_material_procurement(
        self, scope_summary: str, commodity_prices: list,
        commodity_trends: list, location: str
    ) -> dict:
        template = await get_prompt_template("material_procurement")
        prompt = template["template_text"].format(
            scope_summary=scope_summary,
            commodity_prices=json.dumps(commodity_prices),
            commodity_trends=json.dumps(commodity_trends),
            location=location,
        )
        raw = await asyncio.to_thread(
            self.claude.generate,
            prompt=prompt,
            max_tokens=template.get("max_tokens", 4096),
        )
        return self._parse_json(raw)

    async def _run_sub_scheduling(
        self, scope_summary: str, estimate_summary: str,
        subcontractor_data: str, project_timeline: str
    ) -> dict:
        template = await get_prompt_template("sub_scheduling")
        prompt = template["template_text"].format(
            scope_summary=scope_summary,
            estimate_summary=estimate_summary,
            subcontractor_data=subcontractor_data,
            project_timeline=project_timeline,
        )
        raw = await asyncio.to_thread(
            self.claude.generate,
            prompt=prompt,
            max_tokens=template.get("max_tokens", 4096),
        )
        return self._parse_json(raw)

    def _format_tables(self, tables: list) -> str:
        if not tables:
            return "No tables found in document."
        parts = []
        for i, table in enumerate(tables, 1):
            parts.append(f"Table {i}:")
            for row in table:
                parts.append(" | ".join(row))
            parts.append("")
        return "\n".join(parts)

    def _parse_json(self, raw_text: str) -> dict:
        cleaned = re.sub(r'^```(?:json)?\s*', '', raw_text.strip())
        cleaned = re.sub(r'\s*```$', '', cleaned)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            json_match = re.search(r'[\[{].*[\]}]', cleaned, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
            # Log truncated response for debugging
            print(f"[BidAnalyzer] JSON parse error. Response length: {len(raw_text)}. First 500 chars: {raw_text[:500]}")
            print(f"[BidAnalyzer] Last 200 chars: {raw_text[-200:]}")
            return {"raw_response": raw_text[:2000], "parse_error": True}
