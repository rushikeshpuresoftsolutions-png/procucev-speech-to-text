from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import case, func, or_, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Transcription as Entry, utc_now
from ..schemas.transcriptions import Create, Dashboard, Edit, Record, RecordPage

router = APIRouter(prefix="/api")
DB = Annotated[Session, Depends(get_db)]
latest = (Entry.created_at.desc(), Entry.id.desc())


def find_record(db, record_id):
    record = db.get(Entry, record_id)
    if record is None:
        raise HTTPException(404, "Transcription was not found.")
    return record


@router.get("/health")
def health(db: DB, response: Response):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        response.status_code = 503
        return {"status": "unavailable", "database": "disconnected"}
    return {"status": "ok", "database": "connected"}


@router.post("/transcriptions", response_model=Record, status_code=201)
def create(body: Create, db: DB):
    record = Entry(**body.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/transcriptions", response_model=RecordPage)
def listing(db: DB, q: str = Query("", max_length=180), page: int = Query(1, ge=1),
            limit: int = Query(12, ge=1, le=100)):
    query = select(Entry)
    if term := q.strip():
        query = query.where(or_(Entry.title.contains(term, autoescape=True),
                                Entry.content.contains(term, autoescape=True)))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(query.order_by(*latest).offset((page - 1) * limit).limit(limit)).all()
    return {"items": items, "total": total}


@router.get("/transcriptions/{record_id}", response_model=Record)
def detail(record_id: int, db: DB):
    return find_record(db, record_id)


@router.put("/transcriptions/{record_id}", response_model=Record)
def update(record_id: int, body: Edit, db: DB):
    record = find_record(db, record_id)
    record.title, record.content = body.title, body.content
    db.commit()
    db.refresh(record)
    return record


@router.delete("/transcriptions/{record_id}", status_code=204)
def delete(record_id: int, db: DB):
    db.delete(find_record(db, record_id))
    db.commit()
    return Response(status_code=204)


@router.get("/dashboard/stats", response_model=Dashboard)
def dashboard(db: DB, offset_minutes: int = Query(0, ge=-840, le=840)):
    # Offset follows Date.getTimezoneOffset(): UTC minus the local time.
    offset = timedelta(minutes=offset_minutes)
    start = (utc_now() - offset).replace(hour=0, minute=0, second=0, microsecond=0) + offset
    today = (Entry.created_at >= start) & (Entry.created_at < start + timedelta(days=1))
    total, daily, duration = db.execute(select(
        func.count(Entry.id), func.sum(case((today, 1), else_=0)), func.sum(Entry.duration)
    )).one()
    recent = db.scalars(select(Entry).order_by(*latest).limit(5)).all()
    return {"total": total, "today": daily or 0, "duration": duration or 0, "recent": recent}
