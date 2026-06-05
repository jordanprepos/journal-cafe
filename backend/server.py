from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
import bcrypt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'cafe-journal-dev-secret-change-in-prod')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRE_DAYS = 30

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()


# ====== Models ======
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: str
    name: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class CafeCreate(BaseModel):
    name: str = Field(min_length=1)
    photos: List[str] = []  # base64 strings
    location_link: str = ""  # Google Maps share link
    address: str = ""
    notes: str = ""
    rating: int = Field(default=0, ge=0, le=5)
    favorite_drink: str = ""
    visited_date: str = ""  # ISO date string


class CafeUpdate(BaseModel):
    name: Optional[str] = None
    photos: Optional[List[str]] = None
    location_link: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    rating: Optional[int] = Field(default=None, ge=0, le=5)
    favorite_drink: Optional[str] = None
    visited_date: Optional[str] = None


class Cafe(BaseModel):
    id: str
    user_id: str
    name: str
    photos: List[str]
    location_link: str
    address: str
    notes: str
    rating: int
    favorite_drink: str
    visited_date: str
    created_at: str


# ====== Auth helpers ======
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


# ====== Auth endpoints ======
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": data.email.lower(),
        "name": data.name,
        "hashed_password": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id)
    return TokenResponse(
        access_token=token,
        user=UserPublic(id=user_id, email=data.email.lower(), name=data.name),
    )


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if not user or not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(401, "Incorrect email or password")
    token = create_token(user["id"])
    return TokenResponse(
        access_token=token,
        user=UserPublic(id=user["id"], email=user["email"], name=user["name"]),
    )


@api_router.get("/auth/me", response_model=UserPublic)
async def me(user=Depends(get_current_user)):
    return UserPublic(id=user["id"], email=user["email"], name=user["name"])


# ====== Cafe endpoints ======
@api_router.get("/cafes", response_model=List[Cafe])
async def list_cafes(user=Depends(get_current_user)):
    docs = await db.cafes.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Cafe(**d) for d in docs]


@api_router.post("/cafes", response_model=Cafe)
async def create_cafe(data: CafeCreate, user=Depends(get_current_user)):
    cafe_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": cafe_id,
        "user_id": user["id"],
        "name": data.name,
        "photos": data.photos,
        "location_link": data.location_link,
        "address": data.address,
        "notes": data.notes,
        "rating": data.rating,
        "favorite_drink": data.favorite_drink,
        "visited_date": data.visited_date or now[:10],
        "created_at": now,
    }
    await db.cafes.insert_one(doc.copy())
    return Cafe(**doc)


@api_router.get("/cafes/{cafe_id}", response_model=Cafe)
async def get_cafe(cafe_id: str, user=Depends(get_current_user)):
    doc = await db.cafes.find_one({"id": cafe_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Cafe not found")
    return Cafe(**doc)


@api_router.put("/cafes/{cafe_id}", response_model=Cafe)
async def update_cafe(cafe_id: str, data: CafeUpdate, user=Depends(get_current_user)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(400, "No fields to update")
    result = await db.cafes.update_one(
        {"id": cafe_id, "user_id": user["id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Cafe not found")
    doc = await db.cafes.find_one({"id": cafe_id}, {"_id": 0})
    return Cafe(**doc)


@api_router.delete("/cafes/{cafe_id}")
async def delete_cafe(cafe_id: str, user=Depends(get_current_user)):
    result = await db.cafes.delete_one({"id": cafe_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Cafe not found")
    return {"ok": True}


@api_router.get("/stats")
async def stats(user=Depends(get_current_user)):
    docs = await db.cafes.find({"user_id": user["id"]}, {"_id": 0}).to_list(10000)
    total = len(docs)
    avg_rating = round(sum(d["rating"] for d in docs) / total, 2) if total else 0
    # favorite drink (most common)
    drink_counts: dict = {}
    for d in docs:
        drink = (d.get("favorite_drink") or "").strip()
        if drink:
            drink_counts[drink] = drink_counts.get(drink, 0) + 1
    top_drink = max(drink_counts.items(), key=lambda x: x[1])[0] if drink_counts else ""
    # cafes by month
    by_month: dict = {}
    for d in docs:
        date = d.get("visited_date", "")
        if len(date) >= 7:
            month = date[:7]
            by_month[month] = by_month.get(month, 0) + 1
    months_sorted = sorted(by_month.items())[-6:]  # last 6 months
    five_star = sum(1 for d in docs if d["rating"] == 5)
    return {
        "total_cafes": total,
        "average_rating": avg_rating,
        "top_drink": top_drink,
        "five_star_count": five_star,
        "by_month": [{"month": m, "count": c} for m, c in months_sorted],
    }


@api_router.get("/")
async def root():
    return {"message": "Cafe Journal API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
