from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_serializer

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=180)]
Body = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100_000)]
Language = Literal["en", "hi", "mixed", "auto"]


class Edit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Title
    content: Body


class Create(Edit):
    language: Language
    duration: float = Field(ge=0, le=1800, allow_inf_nan=False)


class Record(Create):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def as_utc(self, value: datetime):
        return value.replace(tzinfo=UTC).isoformat()


class RecordPage(BaseModel):
    items: list[Record]
    total: int


class Dashboard(BaseModel):
    total: int
    today: int
    duration: float
    recent: list[Record]
