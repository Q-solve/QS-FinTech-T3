"""Routes matching the frontend's generated API contract."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.core.config import settings
from app.schemas.contract import (
    AnalyzeInput, AnalyzeResponse, BenchmarkResponse, HealthStatus,
    ModelConfig, OverviewResponse,
)
from app.services import contract_service
from app.services.ml_predictor import MLPredictor, get_predictor

router = APIRouter()


def _predictor() -> MLPredictor:
    return get_predictor()


@router.get("/healthz", response_model=HealthStatus)
def healthz(predictor: MLPredictor = Depends(_predictor)):
    return HealthStatus(
        status="ok",
        model_ready=predictor.available,
        execution_mode="live" if predictor.available else "fallback",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/model-config", response_model=ModelConfig)
def model_config():
    return contract_service.build_model_config()


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeInput, predictor: MLPredictor = Depends(_predictor)):
    rid = "req-" + uuid.uuid4().hex[:12]
    return contract_service.build_analyze(predictor, payload, rid)


@router.get("/benchmarks", response_model=BenchmarkResponse)
def benchmarks(predictor: MLPredictor = Depends(_predictor)):
    return contract_service.build_benchmarks(predictor)


@router.get("/overview", response_model=OverviewResponse)
def overview(predictor: MLPredictor = Depends(_predictor)):
    return contract_service.build_overview(predictor)


def configure_contract_routes(app) -> None:
    """Mount routes not under the /api/v1 prefix (healthz lives at /api/healthz)."""
    app.add_api_route("/api/healthz", healthz, methods=["GET"], response_model=HealthStatus)
