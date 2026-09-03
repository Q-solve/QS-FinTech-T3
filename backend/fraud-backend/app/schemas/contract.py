"""Pydantic models matching the frontend's generated API contract (api-client-react)."""
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ExecMode(str, Enum):
    live = "live"
    mock = "mock"
    cached = "cached"
    fallback = "fallback"
    unavailable = "unavailable"


class SystemStatus(str, Enum):
    ready = "ready"
    simulator = "simulator"
    fallback = "fallback"
    unavailable = "unavailable"


class FeatureType(str, Enum):
    number = "number"
    select = "select"
    text = "text"


class BenchRowStatus(str, Enum):
    available = "available"
    unavailable = "unavailable"
    error = "error"


class FeatureOption(BaseModel):
    label: str
    value: str


class FeatureDefinition(BaseModel):
    key: str
    label: str
    type: FeatureType
    unit: Optional[str] = None
    required: bool = True
    min: Optional[float] = None
    max: Optional[float] = None
    placeholder: Optional[str] = None
    description: Optional[str] = None
    options: Optional[List[FeatureOption]] = None


class ModelConfig(BaseModel):
    primary_model: str
    supported_models: List[str]
    feature_schema: List[FeatureDefinition]
    threshold_config: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class AnalyzeInput(BaseModel):
    transaction: Dict[str, Any]


class BenchmarkRow(BaseModel):
    model: str
    roc_auc: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None
    status: BenchRowStatus = BenchRowStatus.available
    note: Optional[str] = None


class BenchmarkResponse(BaseModel):
    benchmark_table: List[BenchmarkRow]
    metadata: Optional[Dict[str, Any]] = None
    execution_mode: ExecMode
    timestamp: Optional[str] = None


class AnalyzeResponse(BaseModel):
    fraud_score: float
    model_used: str
    execution_mode: ExecMode
    risk_band: Optional[str] = None
    transaction: Optional[Dict[str, Any]] = None
    benchmark_table: Optional[List[BenchmarkRow]] = None
    metadata: Optional[Dict[str, Any]] = None
    signal_context: Optional[List[str]] = None
    request_id: Optional[str] = None
    timestamp: Optional[str] = None


class OverviewResponse(BaseModel):
    system_status: SystemStatus
    execution_mode: ExecMode
    primary_model: str
    last_benchmark: Optional[str] = None
    latest_analysis: Optional[AnalyzeResponse] = None
    metadata: Optional[Dict[str, Any]] = None


class HealthStatus(BaseModel):
    status: str
    model_ready: bool
    execution_mode: ExecMode
    timestamp: str
