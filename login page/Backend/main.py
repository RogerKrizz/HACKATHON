import os

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware

from database import Base, engine, get_db
from models import User
from schemas import SignupRequest, SignupResponse, LoginRequest, LoginResponse
from auth import hash_password, verify_password
from google_auth import router as google_router   

app = FastAPI()

app.include_router(google_router)   #  THIS LINE ENABLES GOOGLE LOGIN

# Required for Authlib OAuth (stores state/nonce in session during redirect)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SESSION_SECRET_KEY", "dev-session-secret-change-me"),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


with engine.begin() as conn:
    exists = conn.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name='users' AND column_name='auth_provider'
            LIMIT 1
            """
        )
    ).first()
    if not exists:
        conn.execute(
            text("ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'manual'")
        )

@app.post("/signup", response_model=SignupResponse)
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()

    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=data.email,
        username=data.username,
        password_hash=hash_password(data.password),
        auth_provider="manual"
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "Signup successful",
        "username": new_user.username
    }


@app.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not exist. Create your account")

    # If the user signed up via Google, they may not have a password.
    if user.auth_provider == "google" or not user.password_hash:
        raise HTTPException(status_code=400, detail="This email is registered with Google. Use Google login")

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")

    return {
        "message": "Login successful",
        "email": user.email,
        "username": user.username or "",
    }
