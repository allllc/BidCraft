from pydantic import BaseModel
from typing import Optional


class PromptTemplateResponse(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    category: str
    template_text: str
    variables: list[str]
    model: str
    max_tokens: int
    version: int
    is_default: bool


class PromptTemplateUpdate(BaseModel):
    template_text: Optional[str] = None
    model: Optional[str] = None
    max_tokens: Optional[int] = None
