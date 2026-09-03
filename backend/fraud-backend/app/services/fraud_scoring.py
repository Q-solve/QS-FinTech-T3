from decimal import Decimal
from typing import List

from app.core.config import settings
from app.schemas.fraud import (
    BatchPredictionRequest,
    BatchPredictionResponse,
    PredictionRequest,
    PredictionResponse,
)
from app.services.ml_predictor import get_predictor


class FraudScoringService:
    """
    Scores transactions. Uses the real trained model (champion XGBoost loaded
    from model/data) when available; otherwise falls back to a deterministic
    rule-based scorer so the API always runs.
    """

    def __init__(self):
        self._predictor = get_predictor()
        self.ml_available = self._predictor.available

    # ---- real-model path ----
    def _ml_score(self, request: PredictionRequest) -> PredictionResponse:
        proba = self._predictor.predict_probability(request)
        probability = proba if proba is not None else self._rule_probability(request)
        return PredictionResponse(
            transaction_id=request.transaction_id,
            fraud_probability=round(probability, 4),
            decision="flag" if probability >= 0.5 else "allow",
            risk_factors=self._ml_risk_factors(request, probability),
            model_name=settings.model_name,
            model_version=settings.model_version,
        )

    # ---- rule-based fallback ----
    def _rule_probability(self, request: PredictionRequest) -> float:
        probability = 0.02
        if request.sim_age_days is not None and request.sim_age_days < 7:
            probability += 0.45
        if request.transactions_last_hour >= 10:
            probability += 0.30
        if request.amount > request.sender_balance_before * Decimal("0.8"):
            probability += 0.20
        if request.device_id is None:
            probability += 0.05
        return min(probability, 0.99)

    @staticmethod
    def _rule_risk_factors(request: PredictionRequest) -> List[str]:
        factors: List[str] = []
        if request.sim_age_days is not None and request.sim_age_days < 7:
            factors.append("recent_sim_activation")
        if request.transactions_last_hour >= 10:
            factors.append("high_transaction_velocity")
        if request.amount > request.sender_balance_before * Decimal("0.8"):
            factors.append("large_balance_depletion")
        if request.device_id is None:
            factors.append("missing_device_signal")
        return factors

    def _ml_risk_factors(self, request: PredictionRequest, probability: float) -> List[str]:
        factors: List[str] = []
        if probability >= 0.8:
            factors.append("very_high_model_risk")
        elif probability >= 0.5:
            factors.append("high_model_risk")
        if request.amount > request.sender_balance_before * Decimal("0.8"):
            factors.append("large_balance_depletion")
        if request.transactions_last_hour >= 10:
            factors.append("high_transaction_velocity")
        if request.device_id is None:
            factors.append("missing_device_signal")
        return factors or ["model_scored"]

    def score(self, request: PredictionRequest) -> PredictionResponse:
        if self.ml_available:
            return self._ml_score(request)
        probability = self._rule_probability(request)
        return PredictionResponse(
            transaction_id=request.transaction_id,
            fraud_probability=round(probability, 4),
            decision="flag" if probability >= 0.5 else "allow",
            risk_factors=self._rule_risk_factors(request),
            model_name="rule-based-fallback",
            model_version="0.1.0",
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
