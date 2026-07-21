from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
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

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = 'HS256'
JWT_EXPIRE_DAYS = 30

# Comma-separated origins, e.g. "https://myapp.com,https://preview.myapp.com".
# Defaults to "*" for local/preview convenience; set explicitly in production.
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure indexes exist.
    await db.users.create_index("email", unique=True)
    await db.cafes.create_index("user_id")
    yield
    # Shutdown: close the Mongo connection.
    client.close()


limiter = Limiter(key_func=get_remote_address)
app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
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
    # Free-form labels. Normalised (trimmed, case-insensitively deduped) by the
    # client before it gets here; the cap just stops a runaway client writing an
    # unbounded document.
    tags: List[str] = Field(default=[], max_length=20)
    # Geocoded from `address` on the client; powers "Nearby" sorting.
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


class CafeUpdate(BaseModel):
    name: Optional[str] = None
    photos: Optional[List[str]] = None
    location_link: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    rating: Optional[int] = Field(default=None, ge=0, le=5)
    favorite_drink: Optional[str] = None
    visited_date: Optional[str] = None
    tags: Optional[List[str]] = Field(default=None, max_length=20)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


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
    # Defaulted so cafés logged before tag/geo support still deserialize.
    tags: List[str] = []
    latitude: Optional[float] = None
    longitude: Optional[float] = None


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
@limiter.limit("5/minute")
async def register(request: Request, data: UserRegister):
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
    try:
        await db.users.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(400, "Email already registered")
    token = create_token(user_id)
    return TokenResponse(
        access_token=token,
        user=UserPublic(id=user_id, email=data.email.lower(), name=data.name),
    )


@api_router.post("/auth/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, data: UserLogin):
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
    # List view only renders the cover photo — $slice keeps the payload small.
    docs = await db.cafes.find(
        {"user_id": user["id"]},
        {"_id": 0, "photos": {"$slice": 1}},
    ).sort("created_at", -1).to_list(1000)
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
        "tags": data.tags,
        "latitude": data.latitude,
        "longitude": data.longitude,
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
    # exclude_unset: only touch fields the client actually sent. This preserves
    # an explicit null (e.g. clearing latitude/longitude when the address is
    # removed) while ignoring fields that were simply omitted.
    update_data = data.model_dump(exclude_unset=True)
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
    docs = await db.cafes.find(
        {"user_id": user["id"]},
        {"_id": 0, "rating": 1, "favorite_drink": 1, "visited_date": 1},
    ).to_list(10000)
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

# The app authenticates with bearer tokens (not cookies), so credentialed CORS
# isn't needed — and "*" origins with allow_credentials=True is invalid anyway.
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
