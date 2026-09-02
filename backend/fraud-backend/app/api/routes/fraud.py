from fastapi import APIRouter, Depends, status

from app.schemas.fraud import (
    BatchPredictionRequest,
    BatchPredictionResponse,
    FeedbackRequest,
    FeedbackResponse,
    PredictionRequest,
    PredictionResponse,
)
from app.services.fraud_scoring import FraudScoringService, get_scoring_service


router = APIRouter()


@router.post("/score", response_model=PredictionResponse)
def score_transaction(
    request: PredictionRequest,
    service: FraudScoringService = Depends(get_scoring_service),
):
    return service.score(request)


@router.post("/score/batch", response_model=BatchPredictionResponse)
def score_batch(
    request: BatchPredictionRequest,
    service: FraudScoringService = Depends(get_scoring_service),
):
    return service.score_batch(request)


@router.post(
    "/feedback",
    response_model=FeedbackResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def submit_feedback(request: FeedbackRequest):
    return FeedbackResponse(
        transaction_id=request.transaction_id,
        accepted=True,
        message="Feedback accepted for model evaluation.",
    )