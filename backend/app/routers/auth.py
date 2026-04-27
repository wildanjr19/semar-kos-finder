from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.auth import (
    check_rate_limit,
    create_access_token,
    create_refresh_token,
    record_failure,
    verify_password,
    verify_refresh_token,
)
from app.config import load_config

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request) -> LoginResponse:
    ip = request.client.host if request.client else "unknown"
    check_rate_limit(ip)

    config = load_config()

    if body.username != config.admin_username or not verify_password(
        body.password, config.admin_password_bcrypt
    ):
        record_failure(ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Invalid credentials"},
        )

    access_token = create_access_token(body.username)
    refresh_token = create_refresh_token(body.username)
    return LoginResponse(access_token=access_token, refresh_token=refresh_token)


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(body: RefreshRequest) -> RefreshResponse:
    try:
        username = verify_refresh_token(body.refresh_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Invalid or expired refresh token"},
        )
    access_token = create_access_token(username)
    return RefreshResponse(access_token=access_token)
