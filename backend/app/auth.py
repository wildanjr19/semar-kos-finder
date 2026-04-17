from __future__ import annotations

import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
import bcrypt

from app.config import load_config

ALGORITHM = "HS256"

_security = HTTPBearer(auto_error=False)

# --- Rate limiting (in-memory, per-IP) ---
_MAX_FAILURES = 5
_BACKOFF_SECONDS = 10
_fail_counts: dict[str, list[float]] = defaultdict(list)


def _cleanup_failures(ip: str, now: float) -> None:
    _fail_counts[ip] = [t for t in _fail_counts[ip] if now - t < 60]


def check_rate_limit(ip: str) -> None:
    now = time.monotonic()
    _cleanup_failures(ip, now)
    if len(_fail_counts[ip]) >= _MAX_FAILURES:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "Too many failed attempts. Try again later."},
        )


def record_failure(ip: str) -> None:
    _fail_counts[ip].append(time.monotonic())


# --- JWT ---


def create_access_token(subject: str) -> str:
    config = load_config()
    expire = datetime.now(timezone.utc) + timedelta(minutes=config.jwt_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, config.jwt_secret, algorithm=ALGORITHM)


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_security),
) -> str:
    """FastAPI dependency: validate JWT from Authorization header.

    Returns the token subject (username) on success.
    Raises 401 if missing or invalid.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Not authenticated"},
        )
    try:
        config = load_config()
        payload = jwt.decode(
            credentials.credentials, config.jwt_secret, algorithms=[ALGORITHM]
        )
        username: str | None = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "Invalid token"},
            )
        return username
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Invalid token"},
        )


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
