# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Café Journal — an Expo (React Native) mobile/web app for logging café visits (photos, rating, notes, Google Maps link). All app code lives in `frontend/`. There is **no backend server** — the app talks directly to Firebase (Authentication, Firestore, Cloud Storage). `backend/` and root `tests/` are dead artifacts from a pre-Firebase FastAPI+MongoDB prototype (see git history) — don't extend them; `scripts/export-mongo-cafes.py` and `scripts/import-cafes-to-firestore.mjs` are the one-off migration tools that moved data off it.

## Commands

All frontend commands run from `frontend/`.

```bash
./dev-up.sh                       # from repo root — starts Expo web on :1101, checks .env first
./dev-down.sh                     # stops it

cd frontend
yarn install                      # install deps
yarn web                          # Expo web dev server on :8081 (no location features on web)
yarn start                        # Expo dev server for Expo Go on a phone (needed for Nearby/geocoding)
yarn start -c                     # clear Metro cache if serving stale code
yarn lint                         # expo lint
npx tsc --noEmit                  # typecheck (no separate test suite exists)

npx -y firebase-tools@latest deploy --only firestore,storage   # deploy rule changes
npx -y firebase-tools@latest deploy --only auth                # deploy auth provider changes
```

There is no automated test runner for the frontend — verify changes by running the app (`yarn web` or Expo Go) rather than `yarn test`.

Full one-time Firebase project setup (CLI login, registering iOS/Web apps, enabling providers, provisioning Storage, filling `.env`) is in `RUNNING.md` — read it before assuming a step needs redoing.

## Architecture

**No REST API.** `frontend/src/api/client.ts` talks to Firestore/Storage directly. Two access patterns:
- **Realtime (preferred):** `useCafes()` / `useCafe(id)` from `frontend/src/hooks/use-cafes.ts` wrap Firestore `onSnapshot` — screens re-render on any change (local, remote, or another device) with no refetch.
- **One-shot:** `api.listCafes()`, `api.createCafe()`, `api.updateCafe()`, `api.deleteCafe()`, plus client-side `computeStats(cafes)`.

**Data model:** `users/{uid}/cafes/{cafeId}` in Firestore. Ownership is the document path, not a field — there's no `users` collection; Firebase Auth owns identity. Access control lives entirely in `firestore.rules` / `storage.rules` (scoped to `request.auth.uid`), **never** in client-side filtering. These are prototype rules meant for a single-user-owns-their-data journal — review them before widening access. Photos are uploaded to Cloud Storage and referenced by download URL (`users/{uid}/cafes/{cafeId}/{timestamp}-{index}.jpg`) — never inline base64, since Firestore documents cap at 1 MiB and a single phone photo can exceed that alone. `CafeForm` produces `data:image/jpeg;base64,...` URIs; `client.ts` does the upload-and-swap-to-URL on save.

**Firebase SDK choice is deliberate:** this uses the **Firebase JS SDK** (`firebase/*`), not `@react-native-firebase`, specifically to keep Expo Go and `yarn web` working without `expo prebuild`/a custom dev client. Don't propose switching without raising that tradeoff first.

**Platform splits** use Metro's `.web.ts` suffix convention — the non-`.web` file is native, the `.web` file is web:
- `src/firebase/persistence.ts` (AsyncStorage) vs `.web.ts` (localStorage) — auth session storage
- `src/firebase/google-signin.ts` (expo-auth-session) vs `.web.ts` (`signInWithPopup`) — sign-in flow
- `src/firebase/config.ts` wires these together; it reuses the existing Firebase app/auth instance on Fast Refresh since `initializeApp`/`initializeAuth` throw on a second call

**Routing** is file-based via Expo Router (`frontend/app/`):
- `(auth)/` and `(tabs)/` are route groups (no URL segment); `_layout.tsx` wraps siblings in a `<Stack />`/`<Tabs />`
- `cafe/[id].tsx`, `cafe/edit/[id].tsx` are dynamic segments read via `useLocalSearchParams()`
- `app/index.tsx` is the splash/redirect entry point; `AuthContext` (`src/context/AuthContext.tsx`) gates auth state app-wide via `onAuthStateChanged`

**Conventions:**
- All env values (`EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`) come from `frontend/.env` — never hardcode. None of these are secrets (access control is the security rules), but `.env` is still gitignored per-developer. Expo bakes `EXPO_PUBLIC_*` vars in at startup, so edits require a Metro restart.
- Every interactive UI element has a `testID` (kebab-case, by role).
- React Native primitives only — no HTML/CSS files; styles via `StyleSheet.create()`. Theme constants (colors, spacing, fonts — warm/earthy paper-cream + terracotta design) live in `src/theme.ts`.
