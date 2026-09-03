from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Real-time fraud scoring API for mobile money transactions.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)

# Serve the Forensic Console from the same origin (single URL, no CORS needed)
_FORENSIC_DIR = Path(__file__).resolve().parents[3] / "frontend" / "forensic-dashboard"
if _FORENSIC_DIR.exists():
    app.mount(
        "/console",
        StaticFiles(directory=str(_FORENSIC_DIR), html=True),
        name="forensic",
    )


@app.get("/", include_in_schema=False)
def root():
    return {
        "name": settings.app_name,
        "docs": "/docs",
        "console": "/console/",
        "model_status": "/api/v1/models/active",
    }