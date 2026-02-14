import csv
import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.dependencies import get_firestore

router = APIRouter()


@router.get("/{bid_id}/csv")
async def export_subcontractors_csv(bid_id: str):
    db = get_firestore()
    doc = db.collection("bids").document(bid_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Bid not found")

    bid_data = doc.to_dict()
    analysis = bid_data.get("analysis") or {}
    sub_schedule = analysis.get("sub_scheduling", {})
    matches = sub_schedule.get("matches", [])

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Trade", "Company", "Location", "Confidence",
        "Hourly Rate", "Project Rate", "Available From", "Available To",
        "Mobilize Week", "Contact", "Email", "Phone",
    ])

    for match in matches:
        writer.writerow([
            match.get("trade", ""),
            match.get("company_name", ""),
            match.get("location", ""),
            match.get("confidence", ""),
            match.get("hourly_rate", ""),
            match.get("project_rate", ""),
            match.get("available_from", ""),
            match.get("available_to", ""),
            match.get("mobilize_week", ""),
            match.get("contact_name", ""),
            match.get("email", ""),
            match.get("phone", ""),
        ])

    output.seek(0)
    project_name = bid_data.get("project_name", "bid").replace(" ", "_")
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={project_name}_subcontractors.csv"},
    )
