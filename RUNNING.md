# Running Café Journal locally

Three pieces, each in its own terminal: **MongoDB → API → frontend**.

All commands assume you're in the project root
(`.../journal-cafe` or the worktree you're using).

---

## One-time setup

### 1. Env files

`backend/.env`:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=cafe_journal
JWT_SECRET=<any 32+ char random string>
```

`frontend/.env`:
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

> Both are gitignored. **Create `frontend/.env` before starting Metro** — Expo bakes
> `EXPO_PUBLIC_*` vars in at startup, so edits while it's running require a restart.

### 2. Backend Python venv

Use **Python 3.13** — 3.14 is too new for the pinned dependencies.

```bash
cd backend
python3.13 -m venv venv
venv/bin/pip install -r requirements.txt
```

### 3. Frontend dependencies

```bash
cd frontend
yarn install
```

---

## Every time — 3 terminals

### Terminal 1 — MongoDB (Docker)

```bash
docker start journal-mongo
# first time only:
# docker run -d --name journal-mongo -p 27017:27017 mongo:7
```

### Terminal 2 — API (FastAPI / uvicorn)

```bash
cd backend
venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Health check:
```bash
curl http://localhost:8001/api/    # → {"message":"Cafe Journal API"}
```

### Terminal 3 — Frontend (Expo)

Pick one:

**Browser** — quick UI check (no location features on web):
```bash
cd frontend
yarn web        # → http://localhost:8081
```

**Phone via Expo Go** — required to test "Nearby" / geocoding:
```bash
cd frontend
yarn start      # scan the QR code in the Expo Go app
```

For the phone, `frontend/.env` must point at your Mac's **LAN IP**, not `localhost`:
```env
EXPO_PUBLIC_BACKEND_URL=http://<your-mac-LAN-IP>:8001
```
Find the IP with `ipconfig getifaddr en0`.

---

## Backend test suite

This is an **integration** suite: it hits a live API and reads the base URL from
`frontend/.env` (`EXPO_PUBLIC_BACKEND_URL`), so Mongo and the backend must be up first.

It also registers more users than the `5/minute` cap on `POST /api/auth/register`
allows. Start the backend with rate limiting off, or the last registers come back `429`:

```bash
RATE_LIMIT_ENABLED=false ./dev-up.sh      # or, if starting uvicorn by hand:
# RATE_LIMIT_ENABLED=false venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001

cd backend && venv/bin/python -m pytest tests/ -q
```

`RATE_LIMIT_ENABLED` defaults to `true`, so production and normal local dev are
unaffected — only the test run opts out.

---

## Test account (local dev only)

A throwaway account already exists in the local `cafe_journal` database for quick sign-in:

```
Email:    smoketest@example.com
Password: secret123
```

> ⚠️ Local development only. This is **not** a real credential — it exists only in your
> local MongoDB. Do not reuse this password anywhere real.

---

## Gotchas

- **Order matters:** Mongo → API → frontend. The API creates its Mongo indexes on startup,
  so Mongo must be up first.
- **Don't set `CI=1`** when running Metro yourself — it disables hot reload. Plain
  `yarn web` / `yarn start` gives live reload.
- **Nearby / geocoding is mobile-only** — intentionally disabled on web. Use Expo Go on a
  real device to exercise it.
- **Metro serving stale code?** `yarn start -c` clears the cache.
