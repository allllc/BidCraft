import json
import re

import openai
from google.auth import default
from google.auth.transport import requests as auth_requests

from app.config import settings
from app.db.firestore_client import get_prompt_template


LOCATION = "us-east5"
MODEL_ID = "meta/llama-4-maverick-17b-128e-instruct-maas"


class VertexJudgeService:
    def __init__(self):
        self.project_id = settings.GOOGLE_CLOUD_PROJECT

    def _get_client(self) -> openai.OpenAI:
        credentials, _ = default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        credentials.refresh(auth_requests.Request())

        endpoint_url = (
            f"https://{LOCATION}-aiplatform.googleapis.com/v1/"
            f"projects/{self.project_id}/locations/{LOCATION}/endpoints/openapi"
        )

        return openai.OpenAI(
            base_url=endpoint_url,
            api_key=credentials.token,
            timeout=180.0,
        )

    async def validate(
        self,
        bid_extraction: dict,
        material_procurement: dict,
        sub_scheduling: dict,
        raw_text: str,
    ) -> dict:
        template = await get_prompt_template("judge_validation")
        prompt = template["template_text"].format(
            raw_text=raw_text[:3000],
            bid_extraction=json.dumps(bid_extraction, indent=2)[:4000],
            material_procurement=json.dumps(material_procurement, indent=2)[:4000],
            sub_scheduling=json.dumps(sub_scheduling, indent=2)[:4000],
        )

        try:
            client = self._get_client()
            response = client.chat.completions.create(
                model=MODEL_ID,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=template.get("max_tokens", 4096),
                temperature=0.3,
            )

            raw_response = response.choices[0].message.content
            return self._parse_json(raw_response)

        except Exception as e:
            print(f"[VertexJudge] Error calling Llama Maverick: {e}")
            return {
                "overall_score": 0,
                "passed": False,
                "issues": [
                    {
                        "severity": "warning",
                        "step": "judge_validation",
                        "finding": f"Judge validation could not complete: {str(e)[:200]}",
                        "recommendation": "Review analysis manually",
                    }
                ],
                "summary": "Automated validation unavailable — manual review recommended",
                "model": MODEL_ID,
                "error": True,
            }

    def _parse_json(self, raw_text: str) -> dict:
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_text.strip())
        cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            result = json.loads(cleaned)
        except json.JSONDecodeError:
            json_match = re.search(r"[\[{].*[\]}]", cleaned, re.DOTALL)
            if json_match:
                try:
                    result = json.loads(json_match.group())
                except json.JSONDecodeError:
                    result = None
            else:
                result = None

        if result is None:
            print(f"[VertexJudge] JSON parse error. Response: {raw_text[:500]}")
            return {
                "overall_score": 0,
                "passed": False,
                "issues": [],
                "summary": "Judge response could not be parsed",
                "model": MODEL_ID,
                "parse_error": True,
            }

        result["model"] = MODEL_ID
        return result
