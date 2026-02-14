from pydantic import BaseModel
from typing import Optional


class CommodityPrice(BaseModel):
    name: str
    ticker: str
    current_price: float
    currency: str = "USD"
    change_30d: Optional[float] = None


class InterestRate(BaseModel):
    name: str
    value: Optional[float]
    series_id: str
    as_of: Optional[str] = None


class NewsItem(BaseModel):
    title: str
    link: str
    published: str
    source: str
    summary: str = ""
