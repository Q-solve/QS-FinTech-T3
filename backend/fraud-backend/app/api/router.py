from fastapi import APIRouter

from app.api.routes import fraud, health, models


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(fraud.router, prefix="/fraud", tags=["fraud"])
api_router.include_router(models.router, prefix="/models", tags=["models"])