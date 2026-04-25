from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.auth import check_rate_limit, create_access_token, record_failure, verify_password
from app.config import load_config

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
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

    token = create_access_token(body.username)
    return LoginResponse(access_token=token)
