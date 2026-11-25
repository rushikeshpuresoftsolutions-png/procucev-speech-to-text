import os
from pathlib import Path

from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def connection_url():
    if value := os.getenv("DATABASE_URL"):
        return value
    password = os.getenv("MYSQL_PASSWORD")
    if not password and (secret := os.getenv("MYSQL_PASSWORD_FILE")):
        password = Path(secret).read_text().strip()
    return URL.create(
        "mysql+pymysql", username=os.getenv("MYSQL_USER", "studio"),
        password=password, host=os.getenv("MYSQL_HOST", "mysql"),
        port=int(os.getenv("MYSQL_PORT", 3306)),
        database=os.getenv("MYSQL_DATABASE", "speech_to_text_db"),
        query={"charset": "utf8mb4"},
    )


engine = create_engine(connection_url(), pool_pre_ping=True, pool_recycle=1800)
Session = sessionmaker(engine, expire_on_commit=False)


def get_db():
    with Session() as session:
        yield session
