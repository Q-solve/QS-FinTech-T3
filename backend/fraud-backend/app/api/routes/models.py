from fastapi import APIRouter

from app.core.config import settings
from app.schemas.model import ModelInfo


router = APIRouter()


@router.get("/active", response_model=ModelInfo)
def active_model():
    return ModelInfo(
        name=settings.model_name,
        version=settings.model_version,
        status="ready",
        feature_count=10,
    )