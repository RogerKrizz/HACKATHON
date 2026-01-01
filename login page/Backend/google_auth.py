import os

from fastapi import APIRouter, Request, Depends, HTTPException
from authlib.integrations.starlette_client import OAuth
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models import User

router = APIRouter()

oauth = OAuth()
oauth.register(
    name="google",
  
    client_id=os.environ.get(
        "GOOGLE_CLIENT_ID",
        "96231549409-s097vj2hf20cet6mvamph8utbppbfp60.apps.googleusercontent.com",
    ),
    client_secret=os.environ.get(
        "GOOGLE_CLIENT_SECRET",
        "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",
    ),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


@router.get("/auth/google")
async def google_login(request: Request):
    # Use the incoming host (localhost vs 127.0.0.1) so the session cookie matches.
    redirect_uri = request.url_for("google_callback")
    return await oauth.google.authorize_redirect(request, redirect_uri)




@router.get("/auth/google/callback")
async def google_callback(
    request: Request,
    db: Session = Depends(get_db)
):
    # Google can redirect back with an explicit error.
    if request.query_params.get("error"):
        raise HTTPException(
            status_code=400,
            detail=f"Google OAuth error: {request.query_params.get('error')}",
        )

    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as exc:
   
        raise HTTPException(status_code=400, detail=f"Google OAuth failed: {exc}")

    user_info = token.get("userinfo")
    if not user_info:
        # Prefer id_token claims when available (OIDC)
        try:
            claims = await oauth.google.parse_id_token(request, token)
            if claims:
                user_info = dict(claims)
        except Exception:
            user_info = None

    if not user_info:
        # Fall back to calling the UserInfo endpoint.
        try:
            resp = await oauth.google.get("userinfo", token=token)
            user_info = resp.json() if resp else None
        except Exception:
            user_info = None

    if not user_info:
        raise HTTPException(
            status_code=400,
            detail="Google OAuth succeeded but user profile was not returned (no userinfo/id_token)",
        )

    email = user_info.get("email")
    name = user_info.get("name") or user_info.get("given_name") or user_info.get("preferred_username")

    if not email:
        raise HTTPException(status_code=400, detail="Google OAuth response missing email")

    try:
        user = db.query(User).filter(User.email == email).first()

        if not user:
            user = User(
                email=email,
                username=name,
                auth_provider="google",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail=f"Database error during login: {exc}")

    return {
        "message": "Google login successful",
        "email": user.email,
        "username": user.username
    }

#google auth
