from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import bids, market, subcontractors, prompts, export

app = FastAPI(title="BidCraft API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bids.router, prefix="/api/bids", tags=["bids"])
app.include_router(market.router, prefix="/api/market", tags=["market"])
app.include_router(subcontractors.router, prefix="/api/subcontractors", tags=["subcontractors"])
app.include_router(prompts.router, prefix="/api/prompts", tags=["prompts"])
app.include_router(export.router, prefix="/api/export", tags=["export"])


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "bidcraft-api"}
