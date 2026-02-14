"""Run this script once to seed default data into Firestore."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.db.firestore_client import get_db
from app.prompts.defaults import DEFAULT_PROMPTS

# booked_weeks: list of {"project": str, "start_week": int, "end_week": int}
# Represents existing commitments. Weeks NOT listed are available.
# Week numbers are 1-52 for the year 2026.

SAMPLE_SUBCONTRACTORS = [
    # ── Demolition ──
    {"company_name": "Desert Demo Pros", "trade": "Demolition", "trades": ["Demolition"], "city": "Phoenix", "state": "AZ", "service_radius_miles": 60, "contact_name": "Rick Vasquez", "email": "rick@desertdemo.com", "phone": "602-555-0201", "hourly_rate": 68, "project_rate": 14000, "available_from": "2026-02-01", "available_to": "2026-12-31", "booked_weeks": [{"project": "Retail Demo - Chandler", "start_week": 10, "end_week": 14}, {"project": "Warehouse Teardown", "start_week": 22, "end_week": 25}], "project_types": ["Commercial", "Industrial"], "rating": 4.3},
    {"company_name": "Sonoran Wrecking Co", "trade": "Demolition", "trades": ["Demolition"], "city": "Tempe", "state": "AZ", "service_radius_miles": 50, "contact_name": "Sam Ortiz", "email": "sam@sonoranwrecking.com", "phone": "480-555-0202", "hourly_rate": 72, "project_rate": 16000, "available_from": "2026-03-01", "available_to": "2026-11-30", "booked_weeks": [{"project": "Office Park Demo", "start_week": 14, "end_week": 20}], "project_types": ["Commercial", "Institutional"], "rating": 4.5},
    {"company_name": "Valley Abatement Services", "trade": "Demolition", "trades": ["Demolition"], "city": "Glendale", "state": "AZ", "service_radius_miles": 45, "contact_name": "Nina Patel", "email": "nina@valleyabatement.com", "phone": "623-555-0203", "hourly_rate": 75, "project_rate": 18000, "available_from": "2026-04-01", "available_to": "2026-12-31", "booked_weeks": [{"project": "Hospital Wing Demo", "start_week": 16, "end_week": 22}, {"project": "School Abatement", "start_week": 30, "end_week": 34}], "project_types": ["Commercial", "Industrial", "Institutional"], "rating": 4.1},
    {"company_name": "Cactus Demolition LLC", "trade": "Demolition", "trades": ["Demolition"], "city": "Mesa", "state": "AZ", "service_radius_miles": 55, "contact_name": "Jake Turner", "email": "jake@cactusdemo.com", "phone": "480-555-0204", "hourly_rate": 60, "project_rate": 12000, "available_from": "2026-01-15", "available_to": "2026-12-31", "booked_weeks": [{"project": "Strip Mall Demo", "start_week": 5, "end_week": 9}], "project_types": ["Commercial", "Industrial"], "rating": 4.0},

    # ── Framing ──
    {"company_name": "Arizona Framing LLC", "trade": "Framing", "trades": ["Framing"], "city": "Scottsdale", "state": "AZ", "service_radius_miles": 55, "contact_name": "Derek Hall", "email": "derek@azframing.com", "phone": "480-555-0301", "hourly_rate": 62, "project_rate": 20000, "available_from": "2026-02-15", "available_to": "2026-12-31", "booked_weeks": [{"project": "Condo Framing Phase 1", "start_week": 8, "end_week": 16}, {"project": "Office TI", "start_week": 28, "end_week": 32}], "project_types": ["Commercial", "Institutional"], "rating": 4.4},
    {"company_name": "Precision Stud & Frame", "trade": "Framing", "trades": ["Framing", "Drywall/Interior"], "city": "Chandler", "state": "AZ", "service_radius_miles": 50, "contact_name": "Troy Mitchell", "email": "troy@precisionstud.com", "phone": "480-555-0302", "hourly_rate": 58, "project_rate": 17000, "available_from": "2026-03-01", "available_to": "2026-11-30", "booked_weeks": [{"project": "Medical Office Buildout", "start_week": 12, "end_week": 18}], "project_types": ["Commercial"], "rating": 4.6},
    {"company_name": "Sun Valley Framing", "trade": "Framing", "trades": ["Framing"], "city": "Gilbert", "state": "AZ", "service_radius_miles": 65, "contact_name": "Cathy Reeves", "email": "cathy@sunvalleyframing.com", "phone": "480-555-0303", "hourly_rate": 65, "project_rate": 22000, "available_from": "2026-04-01", "available_to": "2026-10-31", "booked_weeks": [{"project": "Retail Build", "start_week": 18, "end_week": 26}, {"project": "Restaurant TI", "start_week": 34, "end_week": 38}], "project_types": ["Commercial", "Industrial"], "rating": 4.2},
    {"company_name": "Copper State Carpentry", "trade": "Framing", "trades": ["Framing"], "city": "Peoria", "state": "AZ", "service_radius_miles": 50, "contact_name": "Luis Gomez", "email": "luis@copperstatecarp.com", "phone": "623-555-0304", "hourly_rate": 55, "project_rate": 15000, "available_from": "2026-02-01", "available_to": "2026-12-31", "booked_weeks": [], "project_types": ["Commercial", "Industrial"], "rating": 4.0},

    # ── Electrical ──
    {"company_name": "Apex Electrical", "trade": "Electrical", "trades": ["Electrical"], "city": "Phoenix", "state": "AZ", "service_radius_miles": 75, "contact_name": "John Martinez", "email": "john@apexelec.com", "phone": "602-555-0101", "hourly_rate": 85, "project_rate": 18000, "available_from": "2026-03-01", "available_to": "2026-12-31", "booked_weeks": [{"project": "Office Tower Electrical", "start_week": 10, "end_week": 22}], "project_types": ["Commercial", "Industrial"], "rating": 4.5},
    {"company_name": "Southwest Electrical Group", "trade": "Electrical", "trades": ["Electrical"], "city": "Tempe", "state": "AZ", "service_radius_miles": 60, "contact_name": "James Wilson", "email": "james@swelec.com", "phone": "480-555-0201", "hourly_rate": 92, "project_rate": 20000, "available_from": "2026-03-01", "available_to": "2026-12-31", "booked_weeks": [{"project": "Data Center Wiring", "start_week": 6, "end_week": 14}, {"project": "Hospital Wing", "start_week": 20, "end_week": 30}], "project_types": ["Commercial", "Industrial"], "rating": 4.4},

    # ── Plumbing ──
    {"company_name": "Summit Plumbing Co", "trade": "Plumbing", "trades": ["Plumbing"], "city": "Scottsdale", "state": "AZ", "service_radius_miles": 50, "contact_name": "Sarah Chen", "email": "sarah@summitplumb.com", "phone": "480-555-0102", "hourly_rate": 78, "project_rate": 15000, "available_from": "2026-02-15", "available_to": "2026-10-31", "booked_weeks": [{"project": "Apartment Complex Rough-In", "start_week": 8, "end_week": 18}], "project_types": ["Commercial"], "rating": 4.2},
    {"company_name": "Desert Pipe & Plumbing", "trade": "Plumbing", "trades": ["Plumbing"], "city": "Mesa", "state": "AZ", "service_radius_miles": 60, "contact_name": "Ana Morales", "email": "ana@desertpipe.com", "phone": "480-555-0601", "hourly_rate": 75, "project_rate": 14000, "available_from": "2026-02-01", "available_to": "2026-10-31", "booked_weeks": [{"project": "Condo Tower Plumbing", "start_week": 12, "end_week": 24}], "project_types": ["Commercial"], "rating": 4.1},

    # ── HVAC ──
    {"company_name": "Arizona Climate Systems", "trade": "HVAC", "trades": ["HVAC"], "city": "Phoenix", "state": "AZ", "service_radius_miles": 60, "contact_name": "Mike Johnson", "email": "mike@azclimate.com", "phone": "602-555-0103", "hourly_rate": 90, "project_rate": 22000, "available_from": "2026-04-01", "available_to": "2026-11-30", "booked_weeks": [{"project": "Hospital HVAC Retrofit", "start_week": 16, "end_week": 28}], "project_types": ["Commercial", "Industrial"], "rating": 4.8},
    {"company_name": "Coolbreeze HVAC", "trade": "HVAC", "trades": ["HVAC"], "city": "Chandler", "state": "AZ", "service_radius_miles": 50, "contact_name": "Emma Lee", "email": "emma@coolbreezehvac.com", "phone": "480-555-0301", "hourly_rate": 95, "project_rate": 24000, "available_from": "2026-02-15", "available_to": "2026-11-30", "booked_weeks": [{"project": "Office Park HVAC", "start_week": 10, "end_week": 20}], "project_types": ["Commercial"], "rating": 4.6},
    {"company_name": "Alliance Mechanical", "trade": "HVAC", "trades": ["HVAC", "Plumbing"], "city": "Glendale", "state": "AZ", "service_radius_miles": 55, "contact_name": "Greg Foster", "email": "greg@alliancemech.com", "phone": "623-555-0112", "hourly_rate": 88, "project_rate": 21000, "available_from": "2026-03-01", "available_to": "2026-12-31", "booked_weeks": [{"project": "School District HVAC", "start_week": 20, "end_week": 32}], "project_types": ["Commercial", "Industrial", "Institutional"], "rating": 4.5},

    # ── Concrete ──
    {"company_name": "Arizona Concrete Works", "trade": "Concrete", "trades": ["Concrete"], "city": "Tempe", "state": "AZ", "service_radius_miles": 40, "contact_name": "Tom Williams", "email": "tom@azconcrete.com", "phone": "480-555-0104", "hourly_rate": 72, "project_rate": 25000, "available_from": "2026-03-15", "available_to": "2026-09-30", "booked_weeks": [{"project": "Parking Garage Foundation", "start_week": 14, "end_week": 22}], "project_types": ["Commercial", "Institutional"], "rating": 3.9},
    {"company_name": "Red Rock Concrete", "trade": "Concrete", "trades": ["Concrete"], "city": "Scottsdale", "state": "AZ", "service_radius_miles": 70, "contact_name": "Carlos Rodriguez", "email": "carlos@redrockconcrete.com", "phone": "480-555-0401", "hourly_rate": 65, "project_rate": 20000, "available_from": "2026-01-15", "available_to": "2026-12-31", "booked_weeks": [{"project": "Warehouse Slab", "start_week": 4, "end_week": 10}, {"project": "Bridge Footings", "start_week": 24, "end_week": 30}], "project_types": ["Commercial", "Industrial"], "rating": 4.0},

    # ── Steel/Structural ──
    {"company_name": "Iron Peak Structural", "trade": "Steel/Structural", "trades": ["Steel/Structural"], "city": "Phoenix", "state": "AZ", "service_radius_miles": 80, "contact_name": "Angela Davis", "email": "angela@ironpeak.com", "phone": "602-555-0105", "hourly_rate": 95, "project_rate": 35000, "available_from": "2026-05-01", "available_to": "2026-12-31", "booked_weeks": [{"project": "High-Rise Steel Erection", "start_week": 20, "end_week": 36}], "project_types": ["Commercial", "Industrial"], "rating": 4.6},
    {"company_name": "Copper State Steel Erectors", "trade": "Steel/Structural", "trades": ["Steel/Structural"], "city": "Gilbert", "state": "AZ", "service_radius_miles": 65, "contact_name": "Billy Thompson", "email": "billy@copperstatesteel.com", "phone": "480-555-0501", "hourly_rate": 88, "project_rate": 30000, "available_from": "2026-04-01", "available_to": "2026-12-31", "booked_weeks": [{"project": "Industrial Plant Steel", "start_week": 16, "end_week": 24}], "project_types": ["Commercial", "Industrial"], "rating": 4.3},

    # ── Roofing ──
    {"company_name": "Valley Roofing Solutions", "trade": "Roofing", "trades": ["Roofing"], "city": "Mesa", "state": "AZ", "service_radius_miles": 60, "contact_name": "Dave Miller", "email": "dave@valleyroofing.com", "phone": "480-555-0106", "hourly_rate": 70, "project_rate": 12000, "available_from": "2026-04-15", "available_to": "2026-10-31", "booked_weeks": [{"project": "Mall Re-Roof", "start_week": 20, "end_week": 26}], "project_types": ["Commercial"], "rating": 4.0},
    {"company_name": "Sunbelt Roofing", "trade": "Roofing", "trades": ["Roofing"], "city": "Peoria", "state": "AZ", "service_radius_miles": 55, "contact_name": "Kevin O'Brien", "email": "kevin@sunbeltroofing.com", "phone": "623-555-0901", "hourly_rate": 75, "project_rate": 13000, "available_from": "2026-05-01", "available_to": "2026-10-31", "booked_weeks": [{"project": "Hotel Roofing", "start_week": 22, "end_week": 28}, {"project": "School Roof Repair", "start_week": 34, "end_week": 38}], "project_types": ["Commercial", "Industrial"], "rating": 3.9},

    # ── Drywall/Interior ──
    {"company_name": "Western Drywall & Finish", "trade": "Drywall/Interior", "trades": ["Drywall/Interior", "Painting"], "city": "Phoenix", "state": "AZ", "service_radius_miles": 50, "contact_name": "Lisa Brown", "email": "lisa@westerndry.com", "phone": "602-555-0107", "hourly_rate": 55, "project_rate": 8000, "available_from": "2026-03-01", "available_to": "2026-11-30", "booked_weeks": [{"project": "Office TI Drywall", "start_week": 14, "end_week": 20}], "project_types": ["Commercial", "Institutional"], "rating": 4.1},
    {"company_name": "Sonoran Interior Systems", "trade": "Drywall/Interior", "trades": ["Drywall/Interior"], "city": "Scottsdale", "state": "AZ", "service_radius_miles": 50, "contact_name": "Patricia Nguyen", "email": "patricia@sonoraninterior.com", "phone": "480-555-0801", "hourly_rate": 60, "project_rate": 10000, "available_from": "2026-04-01", "available_to": "2026-11-30", "booked_weeks": [{"project": "Tech Office Buildout", "start_week": 16, "end_week": 24}, {"project": "Restaurant Interior", "start_week": 30, "end_week": 34}], "project_types": ["Commercial", "Institutional"], "rating": 4.2},

    # ── Fire Protection ──
    {"company_name": "Phoenix Fire Protection", "trade": "Fire Protection", "trades": ["Fire Protection"], "city": "Phoenix", "state": "AZ", "service_radius_miles": 75, "contact_name": "Robert Kim", "email": "robert@phxfire.com", "phone": "602-555-0108", "hourly_rate": 88, "project_rate": 16000, "available_from": "2026-02-01", "available_to": "2026-12-31", "booked_weeks": [{"project": "High-Rise Sprinkler Install", "start_week": 12, "end_week": 24}], "project_types": ["Commercial", "Industrial", "Institutional"], "rating": 4.7},
    {"company_name": "Pinnacle Fire Systems", "trade": "Fire Protection", "trades": ["Fire Protection"], "city": "Tempe", "state": "AZ", "service_radius_miles": 60, "contact_name": "Steve Harris", "email": "steve@pinnaclefire.com", "phone": "480-555-0701", "hourly_rate": 82, "project_rate": 14500, "available_from": "2026-03-01", "available_to": "2026-12-31", "booked_weeks": [{"project": "Warehouse Fire Suppression", "start_week": 8, "end_week": 14}], "project_types": ["Commercial", "Industrial"], "rating": 4.5},

    # ── Landscaping ──
    {"company_name": "Desert Green Landscaping", "trade": "Landscaping", "trades": ["Landscaping"], "city": "Chandler", "state": "AZ", "service_radius_miles": 45, "contact_name": "Maria Garcia", "email": "maria@desertgreen.com", "phone": "480-555-0109", "hourly_rate": 50, "project_rate": 6000, "available_from": "2026-04-01", "available_to": "2026-10-15", "booked_weeks": [{"project": "Corporate Campus Landscaping", "start_week": 18, "end_week": 24}], "project_types": ["Commercial"], "rating": 3.8},
    {"company_name": "Saguaro Landscape Design", "trade": "Landscaping", "trades": ["Landscaping"], "city": "Scottsdale", "state": "AZ", "service_radius_miles": 40, "contact_name": "Rachel Adams", "email": "rachel@saguarolandscape.com", "phone": "480-555-0111", "hourly_rate": 55, "project_rate": 7500, "available_from": "2026-04-15", "available_to": "2026-10-31", "booked_weeks": [{"project": "Retail Center Site Work", "start_week": 20, "end_week": 28}], "project_types": ["Commercial", "Institutional"], "rating": 4.4},

    # ── Painting ──
    {"company_name": "ProPaint Commercial", "trade": "Painting", "trades": ["Painting"], "city": "Phoenix", "state": "AZ", "service_radius_miles": 50, "contact_name": "Chris Taylor", "email": "chris@propaint.com", "phone": "602-555-0110", "hourly_rate": 48, "project_rate": 5500, "available_from": "2026-03-01", "available_to": "2026-12-31", "booked_weeks": [{"project": "Hotel Repaint", "start_week": 10, "end_week": 16}, {"project": "School Interior Paint", "start_week": 26, "end_week": 30}], "project_types": ["Commercial", "Institutional"], "rating": 4.3},
]


def seed_all():
    db = get_db()

    # Seed prompt templates
    print("Seeding prompt templates...")
    for prompt in DEFAULT_PROMPTS:
        db.collection("prompt_templates").document(prompt["slug"]).set(prompt)
    print(f"  Seeded {len(DEFAULT_PROMPTS)} prompt templates")

    # Seed subcontractors (clear existing first to avoid duplicates)
    print("Clearing existing subcontractors...")
    existing = db.collection("subcontractors").stream()
    for doc in existing:
        doc.reference.delete()

    print("Seeding subcontractors...")
    for sub in SAMPLE_SUBCONTRACTORS:
        import uuid
        sub_id = str(uuid.uuid4())
        db.collection("subcontractors").document(sub_id).set(sub)
    print(f"  Seeded {len(SAMPLE_SUBCONTRACTORS)} subcontractors")

    print("Done!")


if __name__ == "__main__":
    seed_all()
