from pydantic import BaseModel


class ModelInfo(BaseModel):
    name: str
    version: str
    status: str
    feature_count: int