from __future__ import annotations

from pydantic import BaseModel, Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongo_url: str = Field(alias="MONGO_URL")
    jwt_secret: str = Field(alias="JWT_SECRET")
    admin_username: str = Field(alias="ADMIN_USERNAME")
    admin_password_bcrypt: str = Field(alias="ADMIN_PASSWORD_BCRYPT")
    jwt_expire_minutes: int = Field(alias="JWT_EXPIRE_MINUTES")


class Config(BaseModel):
    mongo_url: str
    jwt_secret: str
    admin_username: str
    admin_password_bcrypt: str
    jwt_expire_minutes: int


def load_config() -> Config:
    try:
        settings = Settings()
    except ValidationError as exc:
        raise RuntimeError("Missing or invalid environment variables") from exc
    return Config(
        mongo_url=settings.mongo_url,
        jwt_secret=settings.jwt_secret,
        admin_username=settings.admin_username,
        admin_password_bcrypt=settings.admin_password_bcrypt,
        jwt_expire_minutes=settings.jwt_expire_minutes,
    )
