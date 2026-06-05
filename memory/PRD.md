# Cafe Journal — Product Requirements

## Overview
Personal mobile journal for cafes the user has visited. Multi-user (JWT auth). Each cafe entry includes name, photos, Google Maps share link, address, notes, rating, favorite drink, visited date.

## Tech
- Backend: FastAPI + MongoDB (motor), JWT auth (bcrypt + PyJWT)
- Frontend: Expo Router (React Native), expo-image-picker for photos, secure token storage via @/src/utils/storage

## Features
1. **Auth**: register / login / persistent session
2. **Journal feed**: list of cafes with photo, rating, drink, date; search
3. **Add / edit / delete cafe**: multiple base64 photos, paste Google Maps link, address, notes, 0-5 rating, favorite drink, visited date
4. **Places tab**: list of cafes with location; tap "Open in Google Maps" to launch share link
5. **Stats**: total cafes, avg rating, 5★ count, top drink, last-6-months bar chart
6. **Profile**: shows name/email, logout

## API endpoints
- POST /api/auth/register, /api/auth/login
- GET /api/auth/me
- GET/POST /api/cafes
- GET/PUT/DELETE /api/cafes/{id}
- GET /api/stats
