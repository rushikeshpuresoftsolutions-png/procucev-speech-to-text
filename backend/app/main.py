import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from .config import origins
from .database import Base, engine
from .routes.rest import router as rest
from .websocket.live import router as live


@asynccontextmanager
async def lifespan(app):
    await asyncio.to_thread(Base.metadata.create_all, engine)
    yield
    engine.dispose()


app = FastAPI(title="Procucev Speech Studio", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=sorted(origins),
                   allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type"])
app.include_router(rest)
app.include_router(live)


@app.exception_handler(SQLAlchemyError)
async def database_failure(request: Request, exc: SQLAlchemyError):
    return JSONResponse(status_code=503, content={"detail": "Database unavailable. Please try again."})
