from pydantic import BaseModel
from typing import Optional


class BookedWeek(BaseModel):
    project: str
    start_week: int
    end_week: int


class SubcontractorCreate(BaseModel):
    company_name: str
    trade: str
    trades: list[str] = []
    city: str
    state: str
    service_radius_miles: float = 50.0
    contact_name: str = ""
    email: str = ""
    phone: str = ""
    hourly_rate: Optional[float] = None
    project_rate: Optional[float] = None
    available_from: Optional[str] = None
    available_to: Optional[str] = None
    booked_weeks: list[BookedWeek] = []
    project_types: list[str] = []
    rating: float = 3.0


class SubcontractorResponse(SubcontractorCreate):
    id: str


class MatchRequest(BaseModel):
    bid_id: str
    location: Optional[str] = None
    trades: Optional[list[str]] = None
