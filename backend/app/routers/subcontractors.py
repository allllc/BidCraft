import csv
import io
import uuid

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse

from app.dependencies import get_firestore
from app.models.subcontractor import SubcontractorCreate, MatchRequest
from app.services.subcontractor_service import SubcontractorService

router = APIRouter()

sub_service = SubcontractorService()

CSV_HEADERS = [
    "company_name", "trade", "city", "state", "service_radius_miles",
    "contact_name", "email", "phone", "hourly_rate", "project_rate",
    "available_from", "available_to", "booked_weeks", "project_types",
]


def parse_booked_weeks(raw: str) -> list[dict]:
    """Parse booked_weeks from CSV format: 'Project Name:start-end|Project Name:start-end'"""
    if not raw or not raw.strip():
        return []
    entries = []
    for part in raw.split("|"):
        part = part.strip()
        if ":" not in part:
            continue
        project, weeks = part.rsplit(":", 1)
        if "-" not in weeks:
            continue
        start_str, end_str = weeks.split("-", 1)
        entries.append({
            "project": project.strip(),
            "start_week": int(start_str.strip()),
            "end_week": int(end_str.strip()),
        })
    return entries


@router.get("/csv-template")
async def download_csv_template():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_HEADERS)
    writer.writerow([
        "Apex Electrical", "Electrical", "Phoenix", "AZ", "75",
        "John Martinez", "john@apexelec.com", "602-555-0101", "85", "18000",
        "2026-03-01", "2026-12-31", "Office Tower Electrical:10-22",
        "Commercial|Industrial",
    ])
    writer.writerow([
        "Desert Demo Pros", "Demolition", "Tempe", "AZ", "60",
        "Rick Vasquez", "rick@desertdemo.com", "480-555-0201", "68", "14000",
        "2026-02-01", "2026-12-31", "Retail Demo - Chandler:10-14|Warehouse Teardown:22-25",
        "Commercial|Industrial",
    ])
    writer.writerow([
        "Copper State Carpentry", "Framing", "Scottsdale", "AZ", "50",
        "Luis Gomez", "luis@copperstatecarp.com", "480-555-0304", "55", "15000",
        "2026-02-01", "2026-12-31", "",
        "Commercial",
    ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=subcontractor_template.csv"},
    )


@router.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    db = get_firestore()
    imported = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        try:
            sub_id = str(uuid.uuid4())
            project_types = [t.strip() for t in row.get("project_types", "").split("|") if t.strip()]

            booked = parse_booked_weeks(row.get("booked_weeks", ""))

            db.collection("subcontractors").document(sub_id).set({
                "company_name": row["company_name"],
                "trade": row["trade"],
                "trades": [row["trade"]],
                "city": row.get("city", ""),
                "state": row.get("state", ""),
                "service_radius_miles": float(row.get("service_radius_miles", 50)),
                "contact_name": row.get("contact_name", ""),
                "email": row.get("email", ""),
                "phone": row.get("phone", ""),
                "hourly_rate": float(row["hourly_rate"]) if row.get("hourly_rate") else None,
                "project_rate": float(row["project_rate"]) if row.get("project_rate") else None,
                "available_from": row.get("available_from", ""),
                "available_to": row.get("available_to", ""),
                "booked_weeks": booked,
                "project_types": project_types,
                "rating": 3.0,
            })
            imported += 1
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")

    return {"imported": imported, "errors": errors}


@router.post("/match")
async def match_subcontractors(request: MatchRequest):
    return await sub_service.match(request.bid_id, request.location, request.trades)


@router.get("")
async def list_subcontractors(trade: str = None, location: str = None):
    db = get_firestore()
    query = db.collection("subcontractors")
    if trade:
        query = query.where("trade", "==", trade)
    docs = query.stream()

    subs = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        if location and location.lower() not in f"{data.get('city', '')} {data.get('state', '')}".lower():
            continue
        subs.append(data)
    return subs


@router.post("")
async def create_subcontractor(sub: SubcontractorCreate):
    db = get_firestore()
    sub_id = str(uuid.uuid4())
    data = sub.model_dump()
    if not data["trades"]:
        data["trades"] = [data["trade"]]
    db.collection("subcontractors").document(sub_id).set(data)
    return {"id": sub_id, **data}


@router.put("/{sub_id}")
async def update_subcontractor(sub_id: str, sub: SubcontractorCreate):
    db = get_firestore()
    doc = db.collection("subcontractors").document(sub_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Subcontractor not found")
    data = sub.model_dump()
    if not data["trades"]:
        data["trades"] = [data["trade"]]
    db.collection("subcontractors").document(sub_id).update(data)
    return {"id": sub_id, **data}


@router.delete("/{sub_id}")
async def delete_subcontractor(sub_id: str):
    db = get_firestore()
    doc = db.collection("subcontractors").document(sub_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Subcontractor not found")
    db.collection("subcontractors").document(sub_id).delete()
    return {"success": True}
