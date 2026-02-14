import feedparser

CONSTRUCTION_RSS_FEEDS = [
    {"name": "Construction Dive", "url": "https://www.constructiondive.com/feeds/news/"},
    {"name": "ENR", "url": "https://www.enr.com/rss/news"},
    {"name": "For Construction Pros", "url": "https://www.forconstructionpros.com/rss"},
]


class NewsService:
    def get_news(self, max_items: int = 15) -> list[dict]:
        all_items = []
        for feed_config in CONSTRUCTION_RSS_FEEDS:
            try:
                feed = feedparser.parse(feed_config["url"])
                for entry in feed.entries[:5]:
                    all_items.append({
                        "title": entry.get("title", ""),
                        "link": entry.get("link", ""),
                        "published": entry.get("published", ""),
                        "source": feed_config["name"],
                        "summary": entry.get("summary", "")[:200],
                    })
            except Exception:
                continue
        return all_items[:max_items]
