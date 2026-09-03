from fastapi import APIRouter

from app.core.config import settings
from app.schemas.model import ModelInfo
from app.services.ml_predictor import get_predictor


router = APIRouter()


@router.get("/active", response_model=ModelInfo)
def active_model():
    predictor = get_predictor()
    return ModelInfo(
        name=settings.model_name,
        version=settings.model_version,
        status="ready" if predictor.available else "fallback",
        feature_count=predictor.describe()["feature_count"],
    )