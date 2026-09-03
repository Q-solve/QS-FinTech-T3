from typing import List

import os


class Settings:
    app_name: str = os.getenv("FRAUD_APP_NAME", "FraudBusters API")
    version: str = os.getenv("FRAUD_VERSION", "0.1.0")
    api_prefix: str = os.getenv("FRAUD_API_PREFIX", "/api/v1")
    cors_origins: List[str] = os.getenv(
        "FRAUD_CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:8778",
    ).split(",")
    model_name: str = os.getenv("FRAUD_MODEL_NAME", "qsvm-fraud-classifier")
    model_version: str = os.getenv("FRAUD_MODEL_VERSION", "development")


settings = Settings()