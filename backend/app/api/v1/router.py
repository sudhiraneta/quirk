"""Main API v1 router"""

from fastapi import APIRouter

from app.api.v1.endpoints import users, browsing, analysis, metrics

# Create main API router
api_router = APIRouter()

# Include endpoint routers
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(browsing.router, prefix="/browsing", tags=["browsing"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
