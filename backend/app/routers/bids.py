import json
import uuid
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.dependencies import get_firestore
from app.services.document_parser import extract_docx_text
from app.services.bid_analyzer import BidAnalyzer

router = APIRouter()


@router.post("/upload")
async def upload_bid(
    file: UploadFile = File(...),
    project_name: str = Form(...),
    client_name: str = Form(...),
    location: str = Form(...),
    project_type: str = Form(...),
    bid_due_date: str = Form(...),
):
    if not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")

    content = await file.read()
    raw_text, raw_tables = extract_docx_text(content)

    bid_id = str(uuid.uuid4())
    db = get_firestore()
    db.collection("bids").document(bid_id).set({
        "project_name": project_name,
        "client_name": client_name,
        "location": location,
        "project_type": project_type,
        "bid_due_date": bid_due_date,
        "status": "uploaded",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "raw_text": raw_text,
        "raw_tables": json.dumps(raw_tables),
        "original_filename": file.filename,
        "analysis": None,
    })

    return {"bid_id": bid_id, "status": "uploaded", "project_name": project_name}


@router.get("")
async def list_bids():
    db = get_firestore()
    docs = db.collection("bids").order_by("created_at", direction="DESCENDING").stream()
    bids = []
    for doc in docs:
        data = doc.to_dict()
        analysis = data.get("analysis") or {}
        mp = analysis.get("material_procurement") or {}
        bids.append({
            "bid_id": doc.id,
            "project_name": data.get("project_name"),
            "client_name": data.get("client_name"),
            "status": data.get("status"),
            "created_at": data.get("created_at"),
            "location": data.get("location"),
            "project_type": data.get("project_type"),
            "bid_due_date": data.get("bid_due_date"),
            "estimated_cost": mp.get("total_estimated_cost"),
            "confidence_level": (
                analysis.get("judge_validation", {}).get("overall_score")
            ),
        })
    return bids


@router.get("/{bid_id}")
async def get_bid(bid_id: str):
    db = get_firestore()
    doc = db.collection("bids").document(bid_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Bid not found")
    data = doc.to_dict()
    data["bid_id"] = doc.id
    # Deserialize raw_tables from JSON string
    if isinstance(data.get("raw_tables"), str):
        data["raw_tables"] = json.loads(data["raw_tables"])
    return data


@router.post("/{bid_id}/analyze")
async def analyze_bid(bid_id: str):
    db = get_firestore()
    doc = db.collection("bids").document(bid_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Bid not found")

    bid_data = doc.to_dict()
    bid_data["bid_id"] = bid_id
    # Deserialize raw_tables from JSON string
    if isinstance(bid_data.get("raw_tables"), str):
        bid_data["raw_tables"] = json.loads(bid_data["raw_tables"])

    db.collection("bids").document(bid_id).update({"status": "analyzing"})

    try:
        analyzer = BidAnalyzer()
        analysis = await analyzer.analyze_bid(bid_data)

        db.collection("bids").document(bid_id).update({
            "analysis": analysis,
            "status": "complete",
            "updated_at": datetime.utcnow().isoformat(),
        })

        return {"bid_id": bid_id, "status": "complete", "analysis": analysis}
    except Exception as e:
        db.collection("bids").document(bid_id).update({"status": "error"})
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{bid_id}/prepare")
async def prepare_bid(bid_id: str):
    """Move bid to preparation status after AI analysis review."""
    db = get_firestore()
    doc = db.collection("bids").document(bid_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Bid not found")
    data = doc.to_dict()
    if data.get("status") != "complete":
        raise HTTPException(status_code=400, detail="Bid must be analyzed before preparation")
    db.collection("bids").document(bid_id).update({
        "status": "preparation",
        "updated_at": datetime.utcnow().isoformat(),
    })
    return {"bid_id": bid_id, "status": "preparation"}


@router.put("/{bid_id}/preparation")
async def update_preparation(bid_id: str, updates: dict):
    """Save edits made during bid preparation (schedule, subs, materials)."""
    db = get_firestore()
    doc = db.collection("bids").document(bid_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Bid not found")
    db.collection("bids").document(bid_id).update({
        "preparation": updates,
        "updated_at": datetime.utcnow().isoformat(),
    })
    return {"bid_id": bid_id, "status": "saved"}


@router.post("/{bid_id}/finalize")
async def finalize_bid(bid_id: str):
    """Finalize the bid after preparation."""
    db = get_firestore()
    doc = db.collection("bids").document(bid_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Bid not found")
    db.collection("bids").document(bid_id).update({
        "status": "finalized",
        "updated_at": datetime.utcnow().isoformat(),
    })
    return {"bid_id": bid_id, "status": "finalized"}


@router.delete("/{bid_id}")
async def delete_bid(bid_id: str):
    db = get_firestore()
    doc = db.collection("bids").document(bid_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Bid not found")
    db.collection("bids").document(bid_id).delete()
    return {"success": True}
