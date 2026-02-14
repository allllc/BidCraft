import firebase_admin
from firebase_admin import credentials, firestore

_db = None


def get_db():
    global _db
    if _db is None:
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        _db = firestore.client()
    return _db


async def get_prompt_template(slug: str) -> dict:
    db = get_db()
    docs = db.collection("prompt_templates").where("slug", "==", slug).limit(1).stream()
    for doc in docs:
        return doc.to_dict()
    raise ValueError(f"Prompt template not found: {slug}")
