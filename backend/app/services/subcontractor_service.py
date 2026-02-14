from app.dependencies import get_firestore

TRADE_KEYWORDS = {
    "Demolition": ["demolition", "demo", "abatement", "removal", "teardown", "gutting", "strip-out"],
    "Framing": ["framing", "wood framing", "metal stud", "stud framing", "wall framing", "rough carpentry", "lumber framing"],
    "Electrical": ["electrical", "wiring", "conduit", "panel", "switchgear", "lighting", "power"],
    "Plumbing": ["plumbing", "piping", "fixtures", "water", "sewer", "drain", "sanitary"],
    "HVAC": ["hvac", "mechanical", "ductwork", "air conditioning", "heating", "ventilation", "chiller"],
    "Concrete": ["concrete", "foundation", "slab", "footing", "formwork", "rebar"],
    "Steel/Structural": ["steel", "structural", "metal", "iron", "welding", "erection"],
    "Roofing": ["roofing", "roof", "membrane", "flashing", "insulation"],
    "Drywall/Interior": ["drywall", "gypsum", "ceiling", "partition", "interior finish"],
    "Painting": ["painting", "coating", "finish", "prime", "stain"],
    "Landscaping": ["landscaping", "grading", "irrigation", "site work", "paving"],
    "Fire Protection": ["fire protection", "sprinkler", "suppression", "fire alarm"],
}


class SubcontractorService:
    async def get_all_subcontractors(self) -> list[dict]:
        db = get_firestore()
        docs = db.collection("subcontractors").stream()
        subs = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            subs.append(data)
        return subs

    def detect_trades(self, scope_text: str) -> list[dict]:
        text_lower = scope_text.lower()
        detected = []
        for trade, keywords in TRADE_KEYWORDS.items():
            matches = [kw for kw in keywords if kw in text_lower]
            if matches:
                confidence = min(len(matches) / len(keywords) * 100, 100)
                detected.append({
                    "trade": trade,
                    "confidence": round(confidence, 1),
                    "matched_keywords": matches,
                })
        return sorted(detected, key=lambda x: x["confidence"], reverse=True)

    async def match(self, bid_id: str, location: str = None, trades: list[str] = None) -> list[dict]:
        db = get_firestore()

        # Get bid scope for trade detection if no trades provided
        if not trades:
            bid_doc = db.collection("bids").document(bid_id).get()
            if bid_doc.exists:
                bid_data = bid_doc.to_dict()
                scope_text = bid_data.get("raw_text", "")
                analysis = bid_data.get("analysis") or {}
                bid_extraction = analysis.get("bid_extraction", {})
                if bid_extraction.get("summary"):
                    scope_text += " " + bid_extraction["summary"]
                detected = self.detect_trades(scope_text)
                trades = [d["trade"] for d in detected]

        if not trades:
            return []

        all_subs = await self.get_all_subcontractors()
        matches = []

        for sub in all_subs:
            sub_trades = sub.get("trades", [sub.get("trade", "")])
            matching_trades = [t for t in trades if t in sub_trades]
            if not matching_trades:
                continue

            score = len(matching_trades) / len(trades) * 50

            if location and sub.get("city"):
                if location.lower() in f"{sub.get('city', '')} {sub.get('state', '')}".lower():
                    score += 30
                else:
                    score += 10

            if sub.get("available_from") and sub.get("available_to"):
                score += 10

            if sub.get("rating"):
                score += sub["rating"] * 2

            matches.append({
                **sub,
                "matched_trades": matching_trades,
                "confidence": min(round(score, 1), 100),
            })

        return sorted(matches, key=lambda x: x["confidence"], reverse=True)
