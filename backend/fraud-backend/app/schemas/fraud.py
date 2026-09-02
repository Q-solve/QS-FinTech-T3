from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    transaction_id: str = Field(min_length=1, max_length=100)
    timestamp: datetime
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    transaction_type: str = Field(min_length=1, max_length=40)
    sender_id: str = Field(min_length=1, max_length=100)
    receiver_id: str = Field(min_length=1, max_length=100)
    sender_balance_before: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    sender_balance_after: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    receiver_balance_before: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    receiver_balance_after: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    device_id: Optional[str] = Field(default=None, max_length=100)
    location: Optional[str] = Field(default=None, max_length=100)
    sim_age_days: Optional[int] = Field(default=None, ge=0)
    transactions_last_hour: int = Field(default=0, ge=0)


class PredictionResponse(BaseModel):
    transaction_id: str
    fraud_probability: float = Field(ge=0, le=1)
    decision: str
    risk_factors: List[str]
    model_name: str
    model_version: str


class BatchPredictionRequest(BaseModel):
    transactions: List[PredictionRequest] = Field(min_length=1, max_length=1000)


class BatchPredictionResponse(BaseModel):
    predictions: List[PredictionResponse]
    total: int
    flagged: int


class FeedbackRequest(BaseModel):
    transaction_id: str = Field(min_length=1, max_length=100)
    actual_label: bool
    notes: Optional[str] = Field(default=None, max_length=500)


class FeedbackResponse(BaseModel):
    transaction_id: str
    accepted: bool
    message: str