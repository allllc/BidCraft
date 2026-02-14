from functools import lru_cache

import anthropic

from app.config import settings
from app.db.firestore_client import get_db


@lru_cache()
def get_anthropic_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def get_firestore():
    return get_db()
