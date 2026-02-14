from app.config import settings

# Interest rates — displayed on the Interest Rates tab
FRED_RATE_SERIES = {
    "mortgage_30yr": {"id": "MORTGAGE30US", "label": "30-Year Fixed Mortgage Rate"},
    "prime_rate": {"id": "DPRIME", "label": "Bank Prime Loan Rate"},
    "construction_ppi": {"id": "WPUSI012011", "label": "PPI: Construction Materials"},
}

# Commodity PPI series — used by commodity_service for Lumber & Gypsum,
# and available as supplementary trend data for all 5 commodities.
FRED_COMMODITY_SERIES = {
    "steel_ppi": {"id": "WPU101", "label": "PPI: Steel Mill Products"},
    "copper_wire_ppi": {"id": "WPU102502", "label": "PPI: Copper Wire & Cable"},
    "lumber_ppi": {"id": "WPU0811", "label": "PPI: Lumber"},
    "gypsum_ppi": {"id": "WPU057303", "label": "PPI: Gypsum Products"},
    "diesel_ppi": {"id": "APU000074714", "label": "Avg Price: Diesel Fuel (per gal)"},
}


class FredService:
    def get_current_rates(self) -> dict:
        if not settings.FRED_API_KEY:
            return {key: {"value": None, "label": info["label"], "error": "No FRED API key"}
                    for key, info in FRED_RATE_SERIES.items()}

        try:
            from fredapi import Fred
            fred = Fred(api_key=settings.FRED_API_KEY)
        except Exception:
            return {key: {"value": None, "label": info["label"], "error": "FRED init failed"}
                    for key, info in FRED_RATE_SERIES.items()}

        results = {}
        for key, info in FRED_RATE_SERIES.items():
            try:
                data = fred.get_series(info["id"])
                latest = data.dropna().iloc[-1]
                results[key] = {
                    "value": round(float(latest), 2),
                    "label": info["label"],
                    "series_id": info["id"],
                    "as_of": str(data.dropna().index[-1].date()),
                }
            except Exception:
                results[key] = {"value": None, "label": info["label"], "error": "Fetch failed"}
        return results

    def get_commodity_ppi(self) -> dict:
        """Fetch PPI data for all 5 construction commodities."""
        if not settings.FRED_API_KEY:
            return {}

        try:
            from fredapi import Fred
            fred = Fred(api_key=settings.FRED_API_KEY)
        except Exception:
            return {}

        results = {}
        for key, info in FRED_COMMODITY_SERIES.items():
            try:
                data = fred.get_series(info["id"])
                clean = data.dropna()
                if len(clean) < 1:
                    continue
                current = float(clean.iloc[-1])
                prev = float(clean.iloc[-2]) if len(clean) > 1 else None
                results[key] = {
                    "value": round(current, 2),
                    "label": info["label"],
                    "series_id": info["id"],
                    "as_of": str(clean.index[-1].date()),
                    "prev_value": round(prev, 2) if prev else None,
                    "change": round(current - prev, 2) if prev else None,
                }
            except Exception:
                continue
        return results
