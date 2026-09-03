"""Build the frontend contract responses from the real model + our measured data."""
from datetime import datetime, timezone

from app.core.config import settings
from app.services.ml_predictor import get_predictor
from app.schemas.contract import (
    AnalyzeInput, AnalyzeResponse, BenchmarkResponse, BenchmarkRow,
    FeatureDefinition, FeatureOption, FeatureType, ModelConfig, OverviewResponse,
)

# Real benchmark rows measured on the full M-Pesa dataset (MPESA_RESULTS.md) / PaySim.
# Real benchmark rows from the ML sub-team's measured head-to-head (model/README.md §6.3,
# N=500 matched split). QSVM champion is first so the UI's "primary" snapshot is correct.
REAL_BENCHMARKS = [
    {"model": "QSVM (circular ZZ)", "roc_auc": 0.9285, "precision": 0.6053,
     "recall": 0.5610, "f1": 0.5823, "note": "champion · entangled 6-qubit"},
    {"model": "Random Forest", "roc_auc": 0.9491, "precision": 0.7436,
     "recall": 0.7073, "f1": 0.7250, "note": "classical ensemble"},
    {"model": "Kernel SVM (RBF)", "roc_auc": 0.9839, "precision": 0.3305,
     "recall": 0.9512, "f1": 0.4906, "note": "classical kernel"},
    {"model": "XGBoost", "roc_auc": 0.9996, "precision": 0.9535,
     "recall": 0.9951, "f1": 0.9963, "note": "classical champion"},
    {"model": "QSVM (unentangled)", "roc_auc": 0.9149, "precision": 0.2913,
     "recall": 0.7317, "f1": 0.4167, "note": "no entanglement (contrast)"},
]

FEATURE_SCHEMA = [
    FeatureDefinition(key="amount", label="Amount", type=FeatureType.number,
                      unit="KES", required=True, min=0, placeholder="e.g. 85000",
                      description="Transaction amount."),
    FeatureDefinition(key="oldbalanceOrg", label="Sender balance before", type=FeatureType.number,
                      unit="KES", required=True, min=0),
    FeatureDefinition(key="newbalanceOrig", label="Sender balance after", type=FeatureType.number,
                      unit="KES", required=True, min=0),
    FeatureDefinition(key="oldbalanceDest", label="Receiver balance before", type=FeatureType.number,
                      unit="KES", required=True, min=0),
    FeatureDefinition(key="newbalanceDest", label="Receiver balance after", type=FeatureType.number,
                      unit="KES", required=True, min=0),
    FeatureDefinition(key="transactionType", label="Transaction type", type=FeatureType.select,
                      required=True, options=[FeatureOption(label=t, value=t) for t in
                                              ("PAYMENT", "TRANSFER", "CASH_OUT", "CASH_IN", "DEBIT")]),
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_model_config() -> ModelConfig:
    return ModelConfig(
        primary_model=settings.model_name,
        supported_models=[settings.model_name, "rule-based-fallback"],
        feature_schema=FEATURE_SCHEMA,
        threshold_config={"review": 0.45, "high": 0.75},
        metadata={"feature_count": 6, "feature_map": "shallow ZZ feature map", "scaler": "[0, pi]"},
    )


def build_benchmarks(predictor) -> BenchmarkResponse:
    rows = [BenchmarkRow(**b) for b in REAL_BENCHMARKS]
    mode = "live" if predictor.available else "fallback"
    return BenchmarkResponse(
        benchmark_table=rows,
        execution_mode=mode,
        metadata={
            "source": "ML sub-team measured benchmarks (model/README.md)",
            "dataset": "PaySim-derived synthetic transactions",
            "evaluation_split": "matched split",
            "feature_count": 6,
            "qubit_count": 6,
            "execution_backend": "qBraid · statevector simulation",
            "last_run": "2026-09-02",
        },
        timestamp=_now(),
    )


def _score_fields(tx: dict):
    """Map frontend transaction keys -> raw model inputs."""
    f = lambda k: tx.get(k, 0)
    amount = float(f("amount") or 0)
    sbb = float(f("oldbalanceOrg") or f("sender_balance_before") or 0)
    rbb = float(f("oldbalanceDest") or f("receiver_balance_before") or 0)
    return amount, sbb, rbb


def build_analyze(predictor, payload: AnalyzeInput, request_id: str) -> AnalyzeResponse:
    tx = payload.transaction or {}
    amount, sbb, rbb = _score_fields(tx)
    prob = predictor.predict_from_raw(amount=amount, sender_balance_before=sbb,
                                      receiver_balance_before=rbb, hour=float(tx.get("hour") or 12))
    mode = "live" if predictor.available else "fallback"
    if prob is None:  # fallback rule when model unavailable / empty
        prob = 0.5 if amount > 0 and sbb and amount >= sbb else 0.1
        mode = "fallback"
    band = "High risk" if prob >= 0.75 else ("Review" if prob >= 0.45 else "Low risk")
    ctx = []
    if amount >= sbb and sbb > 0:
        ctx.append("Origin balance is substantially depleted")
    if amount > 25000:
        ctx.append("Amount is elevated")
    if tx.get("transactionType") in ("TRANSFER", "CASH_OUT"):
        ctx.append("Transaction type is commonly reviewed")
    return AnalyzeResponse(
        fraud_score=round(min(1.0, max(0.0, prob)), 3),
        model_used=settings.model_name if predictor.available else "rule-based-fallback",
        execution_mode=mode,
        risk_band=band,
        transaction=tx,
        benchmark_table=[BenchmarkRow(**b) for b in REAL_BENCHMARKS],
        metadata={"feature_count": 6, "request_id": request_id},
        signal_context=ctx or ["No unusual signals"],
        request_id=request_id,
        timestamp=_now(),
    )


def build_overview(predictor, latest=None) -> OverviewResponse:
    ready = predictor.available
    return OverviewResponse(
        system_status="ready" if ready else "fallback",
        execution_mode="live" if ready else "fallback",
        primary_model=settings.model_name,
        last_benchmark="2026-09-02",
        latest_analysis=latest,
        metadata={"model_ready": ready, "repo": "QS-FinTech-T3"},
    )
