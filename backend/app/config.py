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
    jwt_refresh_expire_days: int = Field(alias="JWT_REFRESH_EXPIRE_DAYS", default=7)
    llm_api_key: str = Field(alias="LLM_API_KEY", default="")
    llm_api_base: str = Field(alias="LLM_API_BASE", default="https://api.openai.com/v1")
    llm_model: str = Field(alias="LLM_MODEL", default="gpt-4o")
    llm_max_tokens: int = Field(alias="LLM_MAX_TOKENS", default=4096)
    llm_temperature: float = Field(alias="LLM_TEMPERATURE", default=0.1)


class Config(BaseModel):
    mongo_url: str
    jwt_secret: str
    admin_username: str
    admin_password_bcrypt: str
    jwt_expire_minutes: int
    jwt_refresh_expire_days: int
    llm_api_key: str
    llm_api_base: str
    llm_model: str
    llm_max_tokens: int
    llm_temperature: float


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
        jwt_refresh_expire_days=settings.jwt_refresh_expire_days,
        llm_api_key=settings.llm_api_key,
        llm_api_base=settings.llm_api_base,
        llm_model=settings.llm_model,
        llm_max_tokens=settings.llm_max_tokens,
        llm_temperature=settings.llm_temperature,
    )
