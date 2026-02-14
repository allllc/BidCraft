"""
Firestore persistence layer for commodity price data.

Collection: commodity_prices
Document ID: "{commodity_name}:{YYYY-MM}"  e.g. "Copper:2025-06"
Fields:
  - commodity: str
  - month: str (YYYY-MM)
  - value: float
  - source: str ("yfinance" | "fred")
  - updated_at: datetime
"""

import datetime
from app.db.firestore_client import get_db


COLLECTION = "commodity_prices"


def _doc_id(commodity: str, month: str) -> str:
    return f"{commodity}:{month}"


def load_all() -> dict[str, dict[str, float]]:
    """
    Load all persisted commodity prices from Firestore.
    Returns: {commodity_name: {month_str: value}}
    """
    db = get_db()
    result: dict[str, dict[str, float]] = {}
    docs = db.collection(COLLECTION).stream()
    for doc in docs:
        d = doc.to_dict()
        name = d["commodity"]
        month = d["month"]
        value = d["value"]
        if name not in result:
            result[name] = {}
        result[name][month] = value
    return result


def load_commodity(commodity: str) -> dict[str, float]:
    """Load all monthly prices for a single commodity."""
    db = get_db()
    result: dict[str, float] = {}
    docs = (
        db.collection(COLLECTION)
        .where("commodity", "==", commodity)
        .stream()
    )
    for doc in docs:
        d = doc.to_dict()
        result[d["month"]] = d["value"]
    return result


def save_prices(commodity: str, month_data: dict[str, float], source: str):
    """
    Persist monthly prices for a commodity.
    Only writes months that don't already exist (won't overwrite historical).
    """
    db = get_db()
    batch = db.batch()
    now = datetime.datetime.utcnow()
    count = 0

    for month, value in month_data.items():
        doc_id = _doc_id(commodity, month)
        ref = db.collection(COLLECTION).document(doc_id)
        batch.set(ref, {
            "commodity": commodity,
            "month": month,
            "value": round(value, 2),
            "source": source,
            "updated_at": now,
        })
        count += 1
        # Firestore batch limit is 500
        if count >= 400:
            batch.commit()
            batch = db.batch()
            count = 0

    if count > 0:
        batch.commit()


def upsert_current_month(commodity: str, month: str, value: float, source: str):
    """
    Force-update a specific month (used for today's data which may change).
    """
    db = get_db()
    doc_id = _doc_id(commodity, month)
    db.collection(COLLECTION).document(doc_id).set({
        "commodity": commodity,
        "month": month,
        "value": round(value, 2),
        "source": source,
        "updated_at": datetime.datetime.utcnow(),
    })


def delete_month(commodity: str, month: str):
    """Delete a specific month's data (used during refresh)."""
    db = get_db()
    doc_id = _doc_id(commodity, month)
    db.collection(COLLECTION).document(doc_id).delete()


def get_latest_month(commodity: str) -> str | None:
    """Get the most recent month stored for a commodity."""
    db = get_db()
    docs = (
        db.collection(COLLECTION)
        .where("commodity", "==", commodity)
        .order_by("month", direction="DESCENDING")
        .limit(1)
        .stream()
    )
    for doc in docs:
        return doc.to_dict()["month"]
    return None
