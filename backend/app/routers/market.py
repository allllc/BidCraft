from fastapi import APIRouter

from app.services.commodity_service import CommodityService
from app.services.fred_service import FredService
from app.services.news_service import NewsService
from app.services.market_intelligence import MarketIntelligenceService

router = APIRouter()

commodity_service = CommodityService()
fred_service = FredService()
news_service = NewsService()
market_intel_service = MarketIntelligenceService()


@router.get("/commodities")
async def get_commodities():
    from app.services import commodity_store
    stored = commodity_store.load_all()
    current = commodity_service.get_current_prices(stored=stored)
    historical = commodity_service.get_historical_prices(stored=stored)
    return {"current": current, "historical": historical}


@router.post("/commodities/refresh")
async def refresh_commodities():
    """Force re-fetch all commodity data from yfinance/FRED and update Firestore."""
    result = commodity_service.refresh_data()
    return result


@router.get("/commodity-trends")
async def get_commodity_trends():
    """Return 3-month commodity price trend data."""
    return commodity_service.get_price_trends()


@router.get("/rates")
async def get_rates():
    return fred_service.get_current_rates()


@router.get("/news")
async def get_news():
    return news_service.get_news()


@router.get("/summary")
async def get_market_summary():
    return await market_intel_service.get_summary()
