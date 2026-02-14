import json

from app.services.claude_service import ClaudeService
from app.services.commodity_service import CommodityService
from app.services.fred_service import FredService
from app.services.news_service import NewsService
from app.db.firestore_client import get_prompt_template


class MarketIntelligenceService:
    def __init__(self):
        self.claude = ClaudeService()
        self.commodity = CommodityService()
        self.fred = FredService()
        self.news = NewsService()

    async def get_summary(self) -> dict:
        commodity_data = self.commodity.get_current_prices()
        rate_data = self.fred.get_current_rates()
        news_items = self.news.get_news(max_items=10)

        news_headlines = "\n".join(
            f"- {item['title']} ({item['source']})" for item in news_items
        )

        try:
            template = await get_prompt_template("market_summary")
            prompt = template["template_text"].format(
                commodity_data=json.dumps(commodity_data, indent=2),
                rate_data=json.dumps(rate_data, indent=2),
                news_headlines=news_headlines,
            )
        except (ValueError, KeyError):
            prompt = f"""Summarize the current construction market conditions:

COMMODITY PRICES:
{json.dumps(commodity_data, indent=2)}

INTEREST RATES:
{json.dumps(rate_data, indent=2)}

RECENT NEWS:
{news_headlines}

Write a 3-4 paragraph market intelligence briefing for commercial general contractors."""

        summary = self.claude.generate(prompt=prompt, max_tokens=1500)

        return {
            "summary_text": summary,
            "commodities_used": len(commodity_data),
            "news_count": len(news_items),
        }
