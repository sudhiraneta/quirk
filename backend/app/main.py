"""FastAPI application entry point"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time
import logging

from app.config import settings
from app.api.v1.router import api_router
from app.core.logging import setup_logging

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="LangChain-powered personality analysis platform",
    version=settings.app_version,
    debug=settings.debug
)

# CORS middleware (allow extension origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://*",  # Allow all Chrome extension origins
        "http://localhost:3000",  # Development
        settings.api_base_url
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)

    # Log slow requests
    if process_time > 2.0:
        logger.warning(f"Slow request: {request.url.path} took {process_time:.2f}s")

    return response

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)}
    )

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting {settings.app_name} v{settings.app_version}...")
    logger.info(f"Environment: {settings.app_env}")
    logger.info("Quirk API server started successfully")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Quirk API server...")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": settings.app_version,
        "environment": settings.app_env
    }

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Welcome to Quirk API",
        "version": settings.app_version,
        "docs": f"{settings.api_base_url}/docs"
    }

# Include API router
app.include_router(api_router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )
