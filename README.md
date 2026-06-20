# Café Journal ☕

A mobile journal for logging every café you visit — capture photos, paste a Google Maps share link, rate the experience, and look back on your coffee year.

Built with **Expo (React Native)** + **FastAPI** + **MongoDB**.

> 🤖 **Built with [Emergent AI](https://emergent.sh)** — this project was designed, scaffolded, and developed with the help of Emergent's full-stack AI coding agent. From requirement gathering to backend API design, JWT auth, mobile UI, and deployment readiness checks, Emergent assisted at every step.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Authentication Flow](#authentication-flow)
- [Routing](#routing)
- [Development](#development)
- [Deployment](#deployment)
- [Roadmap](#roadmap)

---

## Features

- 🔐 **Multi-user auth** — register, login, JWT-protected sessions (30-day expiry, bcrypt-hashed passwords)
- 📔 **Journal feed** — browse every café you've logged with photo, rating, drink and date
- 🔍 **Search** — filter by café name, address, or favourite drink
- ➕ **Add / edit / delete** — multiple base64 photos, paste a Google Maps share link, star rating, notes, visit date, favourite drink
- 📍 **Places tab** — list of all logged cafés, tap "Open in Google Maps" to launch the saved share link in the Maps app
- 📊 **Stats** — total cafés visited, average rating, top drink, 5★ count, last-6-months bar chart
- 👤 **Profile** — view account info, log out
- 🎨 **Warm earthy design** — paper-cream backgrounds, terracotta accents, serif headings — feels like a real journal

---

## Tech Stack

### Frontend
- **Expo SDK 54** (React Native managed workflow)
- **Expo Router 6** — file-based routing
- **React 19** + **TypeScript**
- **expo-image-picker** — multi-photo upload
- **expo-secure-store** — encrypted JWT storage (via `@/src/utils/storage`)
- **react-native-safe-area-context**, **react-native-reanimated**, **react-native-gesture-handler**
- **@expo/vector-icons** (Ionicons)

### Backend
- **FastAPI** (Python 3) — async REST API
- **Motor** — async MongoDB driver
- **PyJWT** — JWT signing (HS256)
- **bcrypt** — password hashing
- **Pydantic v2** — request/response validation
- **Uvicorn** — ASGI server

### Database
- **MongoDB** — two collections: `users`, `cafes`

---

## Project Structure

```
/app
├── backend/                          ← FastAPI server
│   ├── server.py                     ← All API routes (auth + cafes + stats)
│   ├── requirements.txt
│   └── .env                          ← MONGO_URL, DB_NAME, JWT_SECRET
│
├── frontend/                         ← Expo React Native app
│   ├── app/                          ← File-based routes (Expo Router)
│   │   ├── _layout.tsx               ← Root layout — wraps AuthProvider
│   │   ├── index.tsx                 ← Splash / redirect
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   ├── login.tsx
│   │   │   └── register.tsx
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx           ← Tab bar config
│   │   │   ├── index.tsx             ← Journal feed
│   │   │   ├── places.tsx            ← Places list
│   │   │   ├── stats.tsx
│   │   │   └── profile.tsx
│   │   └── cafe/
│   │       ├── _layout.tsx
│   │       ├── new.tsx               ← Add café
│   │       ├── [id].tsx              ← Detail (dynamic)
│   │       └── edit/[id].tsx         ← Edit café
│   │
│   ├── src/                          ← Non-route code
│   │   ├── api/client.ts             ← Fetch wrapper + endpoint methods
│   │   ├── context/AuthContext.tsx   ← Global auth state
│   │   ├── components/CafeForm.tsx   ← Shared add/edit form
│   │   ├── theme.ts                  ← Colors, spacing, fonts
│   │   └── utils/storage/            ← Secure storage helper
│   │
│   ├── assets/                       ← Icons, splash
│   ├── app.json                      ← Expo config + permissions
│   ├── package.json
│   └── .env                          ← EXPO_PUBLIC_BACKEND_URL, etc.
│
├── memory/
│   ├── PRD.md                        ← Product spec
│   └── test_credentials.md
│
└── README.md
```

---

## Getting Started

### Prerequisites
- **Node.js 18+** and **Yarn**
- **Python 3.10+**
- **MongoDB** running locally (or a connection string)
- **Expo Go** app installed on your phone (for testing on device)

### 1. Install dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
yarn install
```

### 2. Configure environment

Create `backend/.env`:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
JWT_SECRET=change-me-in-production
```

Create `frontend/.env`:
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```
(Or use the preview URL provided by your environment.)

### 3. Run the servers

```bash
# Backend (port 8001)
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend (port 3000 — Metro bundler)
cd frontend
yarn start
```

Scan the QR code in **Expo Go** or open the web preview in your browser.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Purpose | Example |
|---|---|---|
| `MONGO_URL` | MongoDB connection string | `mongodb://localhost:27017` |
| `DB_NAME` | Database name | `test_database` |
| `JWT_SECRET` | HMAC key for signing tokens (keep secret!) | random 32+ char string |

### Frontend (`frontend/.env`)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | Base URL where the API is reachable (without `/api`) |
| `EXPO_PACKAGER_PROXY_URL`, `EXPO_PACKAGER_HOSTNAME` | Set automatically by the dev environment — **do not modify** |

> **Note:** Backend routes are all prefixed with `/api`. The Kubernetes / preview ingress routes `/api/*` to port 8001 (FastAPI) and everything else to port 3000 (Metro).

---

## API Reference

All endpoints are prefixed with `/api`. Protected endpoints require an `Authorization: Bearer <token>` header.

### Auth

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/api/auth/register` | ❌ | `{email, password, name}` | `{access_token, user}` |
| POST | `/api/auth/login` | ❌ | `{email, password}` | `{access_token, user}` |
| GET | `/api/auth/me` | ✅ | — | `{id, email, name}` |

### Cafés

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/api/cafes` | ✅ | — | `Cafe[]` (only your own) |
| POST | `/api/cafes` | ✅ | `CafeInput` | `Cafe` |
| GET | `/api/cafes/{id}` | ✅ | — | `Cafe` |
| PUT | `/api/cafes/{id}` | ✅ | partial `CafeInput` | `Cafe` |
| DELETE | `/api/cafes/{id}` | ✅ | — | `{ok: true}` |

### Stats

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/api/stats` | ✅ | `{total_cafes, average_rating, top_drink, five_star_count, by_month[]}` |

### `CafeInput` shape

```ts
{
  name: string;                // required
  photos: string[];            // base64 data URIs
  location_link: string;       // Google Maps share URL
  address: string;
  notes: string;
  rating: number;              // 0–5
  favorite_drink: string;
  visited_date: string;        // "YYYY-MM-DD"
}
```

### Example: create a café

```bash
curl -X POST https://your-app/api/cafes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Blue Bottle",
    "photos": [],
    "location_link": "https://maps.app.goo.gl/abc",
    "address": "Brooklyn, NY",
    "notes": "Great oat latte",
    "rating": 5,
    "favorite_drink": "Iced oat latte",
    "visited_date": "2026-02-10"
  }'
```

---

## Data Model

### `users` collection
```js
{
  _id: ObjectId,                  // internal — never returned
  id: "uuid-string",              // primary key used by app
  email: "user@example.com",      // lowercased
  name: "Jordan",
  hashed_password: "$2b$12$...",  // bcrypt
  created_at: "2026-02-10T...Z"
}
```

### `cafes` collection
```js
{
  _id: ObjectId,                  // internal — never returned
  id: "uuid-string",
  user_id: "owner-uuid",          // FK to users.id
  name: "Blue Bottle",
  photos: ["data:image/jpeg;base64,...", ...],
  location_link: "https://maps.app.goo.gl/abc",
  address: "Brooklyn, NY",
  notes: "...",
  rating: 5,
  favorite_drink: "Iced oat latte",
  visited_date: "2026-02-10",
  created_at: "2026-02-10T...Z"
}
```

**Conventions:**
- `_id` is always excluded from API responses (`projection={"_id": 0}`)
- The app uses string UUIDs (`id`) as primary keys — never MongoDB ObjectIds
- Photos are stored inline as base64 data URIs (simple, atomic; suitable for ~30 photos/café)
- Dates are stored as ISO strings — `visited_date` uses `YYYY-MM-DD` for easy month grouping

---

## Authentication Flow

```
1. User registers / logs in → backend hashes password (bcrypt) + signs JWT (HS256)
2. JWT returned to client → stored in expo-secure-store (iOS Keychain / Android Keystore)
3. Every protected request includes `Authorization: Bearer <token>`
4. Backend validates JWT via FastAPI dependency `get_current_user`
5. Every DB query filters by `user_id` → multi-user isolation enforced at query level
```

JWT payload:
```json
{ "sub": "<user-uuid>", "exp": <unix-timestamp> }
```

Tokens expire after **30 days**. On app boot, the client calls `/api/auth/me` to verify the stored token is still valid; if not, it clears the token and shows the login screen.

---

## Routing

Routing is **file-based** via Expo Router.

| File | Route |
|---|---|
| `app/index.tsx` | `/` (splash → redirect) |
| `app/(auth)/login.tsx` | `/login` |
| `app/(auth)/register.tsx` | `/register` |
| `app/(tabs)/index.tsx` | `/` (Journal tab) |
| `app/(tabs)/places.tsx` | `/places` |
| `app/(tabs)/stats.tsx` | `/stats` |
| `app/(tabs)/profile.tsx` | `/profile` |
| `app/cafe/new.tsx` | `/cafe/new` |
| `app/cafe/[id].tsx` | `/cafe/<uuid>` (dynamic) |
| `app/cafe/edit/[id].tsx` | `/cafe/edit/<uuid>` (dynamic) |

Special filename rules:
- `_layout.tsx` — wraps sibling routes (renders children inside `<Stack />` or `<Tabs />`)
- `(folder)/` — **route group**, doesn't add a URL segment
- `[param].tsx` — **dynamic segment**, captured by `useLocalSearchParams()`

---

## Development

### Useful commands

```bash
# Backend hot-reload
cd backend && uvicorn server:app --reload

# Frontend Metro bundler
cd frontend && yarn start

# Lint frontend
cd frontend && yarn lint

# Inspect the DB
mongosh "mongodb://localhost:27017/test_database"
> db.users.find({}, {hashed_password:0})
> db.cafes.find()

# Reset a user's password (admin script)
python3 -c "
import bcrypt
from pymongo import MongoClient
client = MongoClient('mongodb://localhost:27017')
db = client['test_database']
hashed = bcrypt.hashpw(b'newpassword', bcrypt.gensalt()).decode()
db.users.update_one({'email': 'user@example.com'}, {'\$set': {'hashed_password': hashed}})
"
```

### Code conventions

- All backend routes prefixed with `/api`
- All env values come from `.env` files — never hardcoded
- All MongoDB reads exclude `_id` via projection
- All datetimes use `datetime.now(timezone.utc)` (not `utcnow()`)
- Every interactive UI element has a `testID` (kebab-case, by role)
- React Native primitives only (no HTML/CSS files); styles via `StyleSheet.create()`

---

## Deployment

This project runs in the Emergent preview environment. To ship to production:

1. Click **Publish** in the Emergent UI (top right)
2. Configure deployment-time secrets (rotate `JWT_SECRET`!)
3. For iOS/Android binaries, follow the build prompts in the Emergent dashboard

---

## Roadmap

Ideas worth building next:

- **Year-in-Café recap** — auto-generated shareable image collage (top cafés, drinks, stats)
- **Tags & categories** — espresso bar / cosy / work-friendly
- **Favourites & wishlist** — places you want to visit
- **Social** — follow friends and see their café feeds
- **Cloud photo storage** — swap base64 for S3/Cloudinary URLs at scale
- **Forgot-password flow** — email-based reset
- **Offline mode** — local cache + sync on reconnect
- **Real map view** — render pins on an actual map (needs Google/Mapbox API key)

---

## Credits

This project was built with the help of **[Emergent AI](https://emergent.sh)** — a full-stack AI coding agent that assisted across the entire build:

- 🗣 **Requirement gathering** — interactive scoping of features, integrations, and design choices
- 🎨 **Design system** — generated the warm earthy theme + design guidelines
- 🛠 **Backend scaffolding** — FastAPI server, MongoDB schema, JWT auth with bcrypt
- 📱 **Mobile UI** — Expo Router file-based routing, screens, forms, navigation
- 🧪 **Automated testing** — 27/27 backend integration tests passed on first run
- 🔒 **Deployment health checks** — secret scanning, env validation, query optimization

If you want to build your own full-stack mobile app like this, give Emergent a try at [emergent.sh](https://emergent.sh).

---

## License

Private project. All rights reserved.
