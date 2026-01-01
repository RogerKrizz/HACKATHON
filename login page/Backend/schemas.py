from pydantic import BaseModel

class SignupRequest(BaseModel):
    email: str
    username: str
    password: str

class SignupResponse(BaseModel):
    message: str
    username: str


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    message: str
    email: str
    username: str
