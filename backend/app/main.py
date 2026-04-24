from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.db import init_db, close_db, is_ready
from app.routers import admin_actions, admin_kos, auth, kos, master_uns


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    try:
        yield
    finally:
        await close_db()


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)

    @app.exception_handler(Exception)
    async def unified_error(request: Request, exc: Exception):
        if isinstance(exc, Exception) and hasattr(exc, "status_code"):
            status = exc.status_code
            detail = getattr(exc, "detail", str(exc))
            if isinstance(detail, dict) and "error" in detail:
                return JSONResponse(status_code=status, content={"error": detail["error"]})
            return JSONResponse(status_code=status, content={"error": str(detail)})
        return JSONResponse(status_code=500, content={"error": "Internal server error"})

    app.include_router(kos.router)
    app.include_router(admin_kos.router)
    app.include_router(admin_actions.router)
    app.include_router(auth.router)
    app.include_router(master_uns.router)

    @app.get("/health")
    def health() -> dict[str, str]:
        db_status = "ok" if is_ready() else "down"
        return {"status": "ok", "db": db_status}

    return app


app = create_app()
