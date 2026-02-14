from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.dependencies import get_firestore
from app.models.prompt_template import PromptTemplateUpdate
from app.prompts.defaults import DEFAULT_PROMPTS

router = APIRouter()


@router.get("")
async def list_prompts():
    db = get_firestore()
    docs = db.collection("prompt_templates").stream()
    templates = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        templates.append(data)
    return sorted(templates, key=lambda t: t.get("slug", ""))


@router.get("/{template_id}")
async def get_prompt(template_id: str):
    db = get_firestore()
    doc = db.collection("prompt_templates").document(template_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Template not found")
    data = doc.to_dict()
    data["id"] = doc.id
    return data


@router.put("/{template_id}")
async def update_prompt(template_id: str, update: PromptTemplateUpdate):
    db = get_firestore()
    doc = db.collection("prompt_templates").document(template_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Template not found")

    updates = {}
    if update.template_text is not None:
        updates["template_text"] = update.template_text
    if update.model is not None:
        updates["model"] = update.model
    if update.max_tokens is not None:
        updates["max_tokens"] = update.max_tokens

    if updates:
        current = doc.to_dict()
        updates["version"] = current.get("version", 0) + 1
        updates["is_default"] = False
        updates["updated_at"] = datetime.utcnow().isoformat()
        db.collection("prompt_templates").document(template_id).update(updates)

    return {"success": True}


@router.post("/reset")
async def reset_prompts():
    db = get_firestore()
    # Delete existing
    docs = db.collection("prompt_templates").stream()
    for doc in docs:
        doc.reference.delete()
    # Re-seed defaults
    for prompt in DEFAULT_PROMPTS:
        db.collection("prompt_templates").document(prompt["slug"]).set(prompt)
    return {"success": True, "count": len(DEFAULT_PROMPTS)}
