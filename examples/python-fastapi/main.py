"""
Truxe + FastAPI Integration Example
"""
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
import httpx
from jose import jwt, JWTError
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Truxe FastAPI Example")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
HEIMDALL_API_URL = os.getenv("HEIMDALL_API_URL", "https://api.truxe.io")
security = HTTPBearer()

# Models
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class MagicLinkRequest(BaseModel):
    email: EmailStr
    redirectUrl: Optional[str] = None

class TokenResponse(BaseModel):
    success: bool
    message: str
    data: dict

# Truxe Client
class TruxeClient:
    def __init__(self, api_url: str):
        self.api_url = api_url
        self.client = httpx.AsyncClient(timeout=10.0)
        self._public_key = None

    async def register(self, email: str, password: str, **metadata):
        try:
            response = await self.client.post(
                f"{self.api_url}/auth/register",
                json={"email": email, "password": password, **metadata}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=e.response.status_code if hasattr(e, 'response') else 500,
                detail=str(e)
            )

    async def login(self, email: str, password: str):
        try:
            response = await self.client.post(
                f"{self.api_url}/auth/login",
                json={"email": email, "password": password}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=e.response.status_code if hasattr(e, 'response') else 500,
                detail=str(e)
            )

    async def request_magic_link(self, email: str, redirect_url: str):
        try:
            response = await self.client.post(
                f"{self.api_url}/auth/magic-link/request",
                json={"email": email, "redirectUrl": redirect_url}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=e.response.status_code if hasattr(e, 'response') else 500,
                detail=str(e)
            )

    async def get_public_key(self):
        """Get and cache Truxe public key"""
        if self._public_key:
            return self._public_key

        try:
            response = await self.client.get(f"{self.api_url}/.well-known/jwks.json")
            response.raise_for_status()
            jwks = response.json()
            # Cache the first key
            self._public_key = jwks["keys"][0] if jwks.get("keys") else None
            return self._public_key
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=500,
                detail="Failed to fetch public key from Truxe"
            )

truxe = TruxeClient(HEIMDALL_API_URL)

# Auth Dependency
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Verify JWT token and return user info"""
    token = credentials.credentials

    try:
        # Get public key from Truxe
        jwk = await truxe.get_public_key()

        # Convert JWK to PEM (simplified - in production use proper JWK library)
        # For RS256, you'd need to properly convert JWK to PEM
        # Here we'll just decode without verification for demo
        # In production, use python-jose with proper JWK support

        payload = jwt.decode(
            token,
            jwk,
            algorithms=["RS256"],
            issuer="https://api.truxe.io",
            audience="truxe-api",
            options={"verify_signature": False}  # TODO: Implement proper signature verification
        )

        return {
            "id": payload.get("sub"),
            "email": payload.get("email"),
            "session_id": payload.get("session_id"),
        }

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Routes
@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/auth/register", response_model=TokenResponse)
async def register(request: RegisterRequest):
    """Register a new user"""
    try:
        result = await truxe.register(
            email=request.email,
            password=request.password,
            name=request.name
        )

        return {
            "success": True,
            "message": "Registration successful",
            "data": result
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Login with email and password"""
    try:
        result = await truxe.login(
            email=request.email,
            password=request.password
        )

        return {
            "success": True,
            "message": "Login successful",
            "data": result
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/magic-link/request")
async def request_magic_link(request: MagicLinkRequest):
    """Request magic link"""
    try:
        redirect_url = request.redirectUrl or f"{os.getenv('APP_URL')}/auth/verify"

        await truxe.request_magic_link(
            email=request.email,
            redirect_url=redirect_url
        )

        return {
            "success": True,
            "message": "Magic link sent to your email"
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/protected")
async def protected_route(current_user: dict = Depends(get_current_user)):
    """Protected route example"""
    return {
        "success": True,
        "message": "This is a protected route",
        "user": current_user
    }

@app.get("/api/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return {
        "success": True,
        "data": {"user": current_user}
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
