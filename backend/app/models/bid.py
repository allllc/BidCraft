from pydantic import BaseModel
from typing import Optional


class BidMetadata(BaseModel):
    project_name: str
    client_name: str
    location: str
    project_type: str
    bid_due_date: str


class BidSummary(BaseModel):
    bid_id: str
    project_name: str
    client_name: str
    status: str
    created_at: str
    location: Optional[str] = None
    project_type: Optional[str] = None
    bid_due_date: Optional[str] = None


class AnalyzeRequest(BaseModel):
    prompt_overrides: Optional[dict] = None
