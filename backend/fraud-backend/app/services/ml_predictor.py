"""
Real-model inference for the fraud API.

Loads the ML sub-team's serialized champion model + quantum angle scaler from
`model/data/` (see model/README.md) and returns a fraud probability.

Feature contract (6 features, order per model/README.md §3):
    amount_to_oldbalance, oldbalanceOrg_log, amount_log,
    orig_depleted,        oldbalanceDest_log, hour

If the artifacts are not present (they are gitignored), `.available` is False
and the service falls back to the deterministic rule scorer — so the API always
starts.
"""

from __future__ import annotations

import math
import os
from datetime import datetime
from typing import List, Optional

try:  # heavy ML deps imported lazily so the API boots without them
    import joblib
    import numpy as np
    _HAS_ML = True
except Exception:  # pragma: no cover
    _HAS_ML = False


# repo/model/data  <- this module lives at backend/fraud-backend/app/services/
_SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
_FRAUD_BACKEND_DIR = os.path.dirname(os.path.dirname(_SERVICES_DIR))  # backend/fraud-backend
_BACKEND_DIR = os.path.dirname(_FRAUD_BACKEND_DIR)                    # backend
_REPO_DIR = os.path.dirname(_BACKEND_DIR)                             # repo root
DEFAULT_MODEL_DIR = os.path.join(_REPO_DIR, "model", "data")


class MLPredictor:
    """Loads the champion classifier + angle scaler and scores transactions."""

    def __init__(self, model_dir: Optional[str] = None):
        self.model_dir = model_dir or os.getenv("MODEL_DATA_DIR", DEFAULT_MODEL_DIR)
        self.available = False
        self._classifier = None
        self._scaler = None
        self._load()

    def _load(self) -> None:
        if not _HAS_ML:
            return
        clf = os.path.join(self.model_dir, "champion_classical_model.joblib")
        sca = os.path.join(self.model_dir, "scaler_angle.joblib")
        if os.path.exists(clf) and os.path.exists(sca):
            try:
                self._classifier = joblib.load(clf)
                self._scaler = joblib.load(sca)
                self.available = True
            except Exception as exc:  # pragma: no cover
                print(f"[ml_predictor] failed to load models: {exc}")

    # ---- feature extraction (matches the trained 6-qubit budget) ----
    @staticmethod
    def _features(*, amount: float, sender_balance_before: float,
                  receiver_balance_before: float, timestamp: datetime) -> List[float]:
        amount = float(amount)
        sbb = float(sender_balance_before)
        rbb = float(receiver_balance_before)
        amount_to_oldbalance = amount / (sbb + 1.0)
        oldbalance_org_log = math.log1p(sbb)
        amount_log = math.log1p(amount)
        orig_depleted = 1.0 if amount >= sbb else 0.0
        oldbalance_dest_log = math.log1p(rbb)
        hour = float(timestamp.hour)
        return [amount_to_oldbalance, oldbalance_org_log, amount_log,
                orig_depleted, oldbalance_dest_log, hour]

    def predict_probability(self, request) -> Optional[float]:
        """Return fraud probability in [0, 1] or None if the model is unavailable."""
        if not self.available or self._classifier is None or self._scaler is None:
            return None
        try:
            x = self._features(
                amount=request.amount,
                sender_balance_before=request.sender_balance_before,
                receiver_balance_before=request.receiver_balance_before,
                timestamp=request.timestamp,
            )
            x_scaled = self._scaler.transform([x])
            proba = self._classifier.predict_proba(x_scaled)[0]
            return float(proba[1])  # column 1 = fraud class
        except Exception as exc:  # pragma: no cover
            print(f"[ml_predictor] scoring error: {exc}")
            return None

    def describe(self) -> dict:
        return {
            "available": self.available,
            "model_dir": self.model_dir,
            "feature_count": 6,
        }


_predictor: Optional[MLPredictor] = None


def get_predictor() -> MLPredictor:
    global _predictor
    if _predictor is None:
        _predictor = MLPredictor()
    return _predictor
