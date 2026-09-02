from decimal import Decimal
from typing import List

from app.core.config import settings
from app.schemas.fraud import (
    BatchPredictionRequest,
    BatchPredictionResponse,
    PredictionRequest,
    PredictionResponse,
)


class FraudScoringService:
    """Temporary deterministic scorer; replace _predict with the trained QSVM."""

    def score(self, request: PredictionRequest) -> PredictionResponse:
        risk_factors: List[str] = []
        probability = 0.02

        if request.sim_age_days is not None and request.sim_age_days < 7:
            probability += 0.45
            risk_factors.append("recent_sim_activation")
        if request.transactions_last_hour >= 10:
            probability += 0.30
            risk_factors.append("high_transaction_velocity")
        if request.amount > request.sender_balance_before * Decimal("0.8"):
            probability += 0.20
            risk_factors.append("large_balance_depletion")
        if request.device_id is None:
            probability += 0.05
            risk_factors.append("missing_device_signal")

        probability = min(probability, 0.99)
        return PredictionResponse(
            transaction_id=request.transaction_id,
            fraud_probability=round(probability, 4),
            decision="flag" if probability >= 0.5 else "allow",
            risk_factors=risk_factors,
            model_name=settings.model_name,
            model_version=settings.model_version,
        )

    def score_batch(self, request: BatchPredictionRequest) -> BatchPredictionResponse:
        predictions = [self.score(transaction) for transaction in request.transactions]
        return BatchPredictionResponse(
            predictions=predictions,
            total=len(predictions),
            flagged=sum(prediction.decision == "flag" for prediction in predictions),
        )


def get_scoring_service() -> FraudScoringService:
    return FraudScoringService()