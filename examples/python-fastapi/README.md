# Truxe + Python FastAPI Integration Example

Complete example of integrating Truxe authentication with Python FastAPI backend.

## Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your values

# Run server
uvicorn main:app --reload
```

## Test

```bash
# Health check
curl http://localhost:8000/health

# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# Protected route (use token from login response)
curl http://localhost:8000/api/protected \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
