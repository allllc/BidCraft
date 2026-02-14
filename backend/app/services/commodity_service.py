import datetime
import logging
import yfinance as yf
from app.config import settings
from app.services import commodity_store

logger = logging.getLogger(__name__)

# ── yfinance tickers (real-time market data) ──
YFINANCE_TICKERS = {
    "Structural Steel (HRC)": "HRC=F",
    "Copper": "HG=F",
    "Diesel Fuel": "HO=F",
}

# ── FRED PPI series (monthly index data — only source for Lumber & Gypsum) ──
FRED_COMMODITY_SERIES = {
    "Lumber (Framing)": "WPU0811",
    "Gypsum Board": "WPU057303",
}

COMMODITY_SOURCE = {}
for _n in YFINANCE_TICKERS:
    COMMODITY_SOURCE[_n] = "yfinance"
for _n in FRED_COMMODITY_SERIES:
    COMMODITY_SOURCE[_n] = "fred"

# All 5 commodities in display order
ALL_COMMODITIES = [
    "Structural Steel (HRC)",
    "Copper",
    "Diesel Fuel",
    "Lumber (Framing)",
    "Gypsum Board",
]

COMMODITY_UNITS = {
    "Structural Steel (HRC)": "$/ton",
    "Copper": "$/lb",
    "Diesel Fuel": "$/gal",
    "Lumber (Framing)": "PPI Index",
    "Gypsum Board": "PPI Index",
}


def _all_months_between(start: str, end: str) -> list[str]:
    """Generate list of YYYY-MM strings from start to end inclusive."""
    sy, sm = int(start[:4]), int(start[5:7])
    ey, em = int(end[:4]), int(end[5:7])
    result = []
    y, m = sy, sm
    while (y, m) <= (ey, em):
        result.append(f"{y}-{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return result


class CommodityService:

    START_DATE = "2025-01-01"
    START_MONTH = "2025-01"

    # ── current prices (card display) ──────────────────────────────
    def get_current_prices(self, stored: dict | None = None) -> list[dict]:
        """
        Returns current prices from Firestore persisted data.
        Pass `stored` to reuse an already-loaded dataset.
        """
        today = datetime.date.today()
        current_month = today.strftime("%Y-%m")

        if stored is None:
            stored = commodity_store.load_all()

        results = []

        for name in ALL_COMMODITIES:
            vals = stored.get(name, {})
            # Use current month, or fall back to the most recent month available
            current_val = vals.get(current_month)
            if current_val is None:
                recent = sorted(vals.keys())
                if recent:
                    current_val = vals[recent[-1]]
                else:
                    continue

            ticker = YFINANCE_TICKERS.get(name) or FRED_COMMODITY_SERIES.get(name, "")
            unit = COMMODITY_UNITS.get(name, "USD")

            prev_month = self._prev_month(current_month)
            prev_val = vals.get(prev_month)
            change_30d = round(current_val - prev_val, 2) if prev_val else None

            results.append({
                "name": name,
                "ticker": ticker,
                "current_price": round(current_val, 2),
                "currency": "USD",
                "unit": unit,
                "change_30d": change_30d,
            })

        return results

    # ── monthly historical + forecast (with Firestore persistence) ──
    def get_historical_prices(self, stored: dict | None = None) -> dict:
        """
        1. Load persisted data from Firestore
        2. Determine which months are missing up to current month
        3. Fetch only missing months from yfinance/FRED
        4. Persist new data to Firestore
        5. Build response with forecasts
        """
        today = datetime.date.today()
        current_month = today.strftime("%Y-%m")

        # Step 1: Load from Firestore (or use pre-loaded data)
        if stored is None:
            stored = commodity_store.load_all()

        # Step 2: Find missing months per commodity
        needed_months = _all_months_between(self.START_MONTH, current_month)
        missing_by_source: dict[str, list[str]] = {"yfinance": [], "fred": []}

        for name in ALL_COMMODITIES:
            stored_months = set(stored.get(name, {}).keys())
            commodity_missing = [m for m in needed_months if m not in stored_months]
            if commodity_missing:
                src = COMMODITY_SOURCE[name]
                missing_by_source[src].extend(commodity_missing)

        # Step 3: Fetch only what's missing
        has_yf_missing = any(
            m for name in YFINANCE_TICKERS
            for m in needed_months
            if m not in stored.get(name, {})
        )

        # FRED PPI data typically lags 2+ months, so only check up to 2 months ago
        fred_cutoff = self._prev_month(self._prev_month(current_month))
        fred_needed = [m for m in needed_months if m <= fred_cutoff]
        has_fred_missing = any(
            m for name in FRED_COMMODITY_SERIES
            for m in fred_needed
            if m not in stored.get(name, {})
        )

        if has_yf_missing:
            yf_data = self._yfinance_monthly(self.START_DATE)
            for name, month_data in yf_data.items():
                stored_months = set(stored.get(name, {}).keys())
                new_months = {m: v for m, v in month_data.items() if m not in stored_months}
                if new_months:
                    commodity_store.save_prices(name, new_months, "yfinance")
                    if name not in stored:
                        stored[name] = {}
                    stored[name].update(new_months)

        if has_fred_missing:
            fred_data = self._fred_monthly(self.START_DATE)
            for name, month_data in fred_data.items():
                stored_months = set(stored.get(name, {}).keys())
                new_months = {m: v for m, v in month_data.items() if m not in stored_months}
                if new_months:
                    commodity_store.save_prices(name, new_months, "fred")
                    if name not in stored:
                        stored[name] = {}
                    stored[name].update(new_months)

        # Only update current month if yfinance commodities are missing
        # (FRED PPI data lags by a month or more, so don't wait on it)
        # Use the refresh endpoint for forced updates of everything.
        yf_has_current = all(
            current_month in stored.get(name, {})
            for name in YFINANCE_TICKERS
        )
        if not yf_has_current:
            self._update_current_month(stored, current_month)

        # Step 5: Build response rows from stored data
        all_months_map: dict[str, dict] = {}
        for name, month_data in stored.items():
            for month_str, value in month_data.items():
                if month_str not in all_months_map:
                    all_months_map[month_str] = {"month": month_str}
                all_months_map[month_str][name] = round(value, 2)

        sorted_months = sorted(all_months_map.keys())
        rows = []
        for m in sorted_months:
            row = all_months_map[m]
            if m < current_month:
                row["type"] = "actual"
            elif m == current_month:
                row["type"] = "current"
            else:
                row["type"] = "forecast"
            rows.append(row)

        # Add forecast for remaining months
        rows = self._add_forecast(rows, today)

        return {
            "monthly": rows,
            "commodities": ALL_COMMODITIES,
        }

    def _update_current_month(self, stored: dict, current_month: str):
        """Update current month yfinance data only (fast — 5-day fetch per ticker).
        FRED data is only updated via refresh_data() since it fetches entire series."""
        for name, ticker in YFINANCE_TICKERS.items():
            try:
                data = yf.Ticker(ticker)
                hist = data.history(period="5d")
                if not hist.empty:
                    val = float(hist["Close"].iloc[-1])
                    commodity_store.upsert_current_month(name, current_month, val, "yfinance")
                    if name not in stored:
                        stored[name] = {}
                    stored[name][current_month] = round(val, 2)
            except Exception:
                logger.warning(f"Failed to update current month for {name}")

    def refresh_data(self) -> dict:
        """
        Force re-fetch ALL data from APIs and update Firestore.
        Called by the refresh endpoint.
        """
        today = datetime.date.today()
        current_month = today.strftime("%Y-%m")

        # Fetch fresh data from both sources
        yf_data = self._yfinance_monthly(self.START_DATE)
        fred_data = self._fred_monthly(self.START_DATE)

        # Persist everything (overwrites existing)
        for name, month_data in yf_data.items():
            commodity_store.save_prices(name, month_data, "yfinance")

        for name, month_data in fred_data.items():
            commodity_store.save_prices(name, month_data, "fred")

        # Update current month with latest
        stored = {**yf_data, **fred_data}
        self._update_current_month(stored, current_month)

        return {"status": "refreshed", "commodities": len(stored), "as_of": current_month}

    def _yfinance_monthly(self, start_date: str) -> dict[str, dict[str, float]]:
        """Get monthly close prices from yfinance for each ticker."""
        result: dict[str, dict[str, float]] = {}
        for name, ticker in YFINANCE_TICKERS.items():
            try:
                data = yf.Ticker(ticker)
                hist = data.history(start=start_date)
                if hist.empty:
                    continue
                monthly = hist["Close"].resample("ME").last().dropna()
                month_data: dict[str, float] = {}
                for dt, val in monthly.items():
                    month_str = dt.strftime("%Y-%m")
                    month_data[month_str] = float(val)
                result[name] = month_data
            except Exception:
                continue
        return result

    def _fred_monthly(self, start_date: str) -> dict[str, dict[str, float]]:
        """Get monthly PPI values from FRED."""
        if not settings.FRED_API_KEY:
            return {}
        try:
            from fredapi import Fred
            fred = Fred(api_key=settings.FRED_API_KEY)
        except Exception:
            return {}

        result: dict[str, dict[str, float]] = {}
        for name, series_id in FRED_COMMODITY_SERIES.items():
            try:
                data = fred.get_series(series_id, observation_start=start_date)
                clean = data.dropna()
                month_data: dict[str, float] = {}
                for dt, val in clean.items():
                    month_str = dt.strftime("%Y-%m")
                    month_data[month_str] = float(val)
                result[name] = month_data
            except Exception:
                continue
        return result

    def _add_forecast(self, rows: list[dict], today: datetime.date) -> list[dict]:
        """
        Extrapolate remaining months of current year using prior year
        month-over-month % changes.
        """
        current_year = today.year
        prev_year = current_year - 1

        by_commodity: dict[str, dict[str, float]] = {}
        for row in rows:
            for name in ALL_COMMODITIES:
                if name in row:
                    if name not in by_commodity:
                        by_commodity[name] = {}
                    by_commodity[name][row["month"]] = row[name]

        pct_changes_prev: dict[str, dict[int, float]] = {}
        for name in ALL_COMMODITIES:
            vals = by_commodity.get(name, {})
            pct_changes_prev[name] = {}
            for m in range(2, 13):
                prev_key = f"{prev_year}-{m - 1:02d}"
                curr_key = f"{prev_year}-{m:02d}"
                if prev_key in vals and curr_key in vals and vals[prev_key] != 0:
                    pct_changes_prev[name][m] = (vals[curr_key] - vals[prev_key]) / vals[prev_key]

        # Find the last actual data point for each commodity.
        # Check current year first, then fall back to previous year's last month.
        last_actual: dict[str, tuple[int, float]] = {}
        for name in ALL_COMMODITIES:
            vals = by_commodity.get(name, {})
            # Try current year first
            found = False
            for m in range(12, 0, -1):
                key = f"{current_year}-{m:02d}"
                if key in vals:
                    last_actual[name] = (m, vals[key])
                    found = True
                    break
            # Fall back to last month of previous year
            if not found:
                for m in range(12, 0, -1):
                    key = f"{prev_year}-{m:02d}"
                    if key in vals:
                        # Use month 0 to indicate "before current year"
                        last_actual[name] = (0, vals[key])
                        break

        current_month_num = today.month

        # Forecast all months of current year that don't have actual data
        # (not just months after current — some commodities may be missing earlier months too)
        forecast_months = list(range(1, 13))

        for fm in forecast_months:
            month_str = f"{current_year}-{fm:02d}"
            existing = next((r for r in rows if r["month"] == month_str), None)

            if existing is None:
                row_type = "forecast" if fm > current_month_num else "actual"
                existing = {"month": month_str, "type": row_type}
                rows.append(existing)

            for name in ALL_COMMODITIES:
                if name in existing:
                    continue  # already has actual data
                la = last_actual.get(name)
                if la is None:
                    continue
                last_m, last_val = la
                # Only forecast from the month after the last actual
                if fm <= last_m:
                    continue
                projected = last_val
                for step_m in range(last_m + 1, fm + 1):
                    pct = pct_changes_prev.get(name, {}).get(step_m, 0.0)
                    projected *= (1 + pct)
                existing[name] = round(projected, 2)
                # Mark as forecast if beyond current month
                if fm > current_month_num:
                    existing["type"] = "forecast"

        rows.sort(key=lambda r: r["month"])
        return rows

    # ── price trends (used by market intelligence) ─────────────────
    def get_price_trends(self) -> list[dict]:
        """3-month trend from persisted data, falls back to live API."""
        trends = []
        stored = commodity_store.load_all()
        today = datetime.date.today()
        current_month = today.strftime("%Y-%m")

        for name in YFINANCE_TICKERS:
            vals = stored.get(name, {})
            # Get last 3 months
            months = sorted(m for m in vals if m <= current_month)
            if len(months) >= 3:
                recent = vals[months[-1]]
                older = vals[months[-3]]
                if older > 0:
                    change = ((recent - older) / older) * 100
                    direction = "rising" if change > 2 else "falling" if change < -2 else "stable"
                    trends.append({
                        "name": name,
                        "direction": direction,
                        "change_pct": round(change, 2),
                    })
            else:
                # Fallback to live
                ticker = YFINANCE_TICKERS[name]
                try:
                    data = yf.Ticker(ticker)
                    hist = data.history(period="3mo")
                    if not hist.empty and len(hist) > 20:
                        recent_avg = hist["Close"].iloc[-5:].mean()
                        older_avg = hist["Close"].iloc[:5].mean()
                        if older_avg > 0:
                            change = ((recent_avg - older_avg) / older_avg) * 100
                            direction = "rising" if change > 2 else "falling" if change < -2 else "stable"
                            trends.append({
                                "name": name,
                                "direction": direction,
                                "change_pct": round(change, 2),
                            })
                except Exception:
                    continue
        return trends

    @staticmethod
    def _prev_month(month: str) -> str:
        y, m = int(month[:4]), int(month[5:7])
        m -= 1
        if m < 1:
            m = 12
            y -= 1
        return f"{y}-{m:02d}"
