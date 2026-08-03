# Café Journal ☕

A mobile journal for logging every café you visit — capture photos, paste a Google Maps share link, rate the experience, and look back on your coffee year.

Built with **Expo (React Native)** + **Firebase** (Authentication, Cloud Firestore, Cloud Storage).

Café entries sync in **realtime** — an edit on your phone lands on every other signed-in device without a refresh.

> 🤖 **Built with [Emergent AI](https://emergent.sh)** — this project was designed, scaffolded, and developed with the help of Emergent's full-stack AI coding agent. From requirement gathering to backend API design, JWT auth, mobile UI, and deployment readiness checks, Emergent assisted at every step.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Data Access](#data-access)
- [Data Model](#data-model)
- [Authentication Flow](#authentication-flow)
- [Routing](#routing)
- [Development](#development)
- [Deployment](#deployment)
- [Roadmap](#roadmap)

---

## Features

- 🔐 **Multi-user auth** — Firebase Authentication with Email/Password **and Google Sign-in**
- ⚡ **Realtime sync** — Firestore listeners push every add, edit and delete to all your devices at once
- 📔 **Journal feed** — browse every café you've logged with photo, rating, drink and date
- 🔍 **Search** — filter by café name, address, or favourite drink
- ➕ **Add / edit / delete** — multiple photos (stored in Cloud Storage), paste a Google Maps share link, star rating, notes, visit date, favourite drink
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
- **expo-auth-session** — Google OAuth on device
- **@react-native-async-storage/async-storage** — Firebase Auth session persistence
- **react-native-safe-area-context**, **react-native-reanimated**, **react-native-gesture-handler**
- **@expo/vector-icons** (Ionicons)

### Backend — Firebase
No server to run or deploy. The app is a direct Firebase client.

- **Firebase Authentication** — Email/Password + Google Sign-in
- **Cloud Firestore** — café documents, with `onSnapshot` realtime listeners
- **Cloud Storage** — café photos, referenced from Firestore by download URL
- **Security Rules** — `firestore.rules` / `storage.rules` enforce per-user access
- **firebase JS SDK v12** — works in Expo Go and on web, no custom dev build needed

---

## Project Structure

```
/app
├── firebase.json                     ← Auth providers + rules wiring
├── firestore.rules                   ← Per-user access rules for café docs
├── firestore.indexes.json
├── storage.rules                     ← Per-user access rules for photos
│
├── scripts/                          ← One-off MongoDB → Firestore migration
│   ├── export-mongo-cafes.py
│   └── import-cafes-to-firestore.mjs
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
│   │   ├── firebase/
│   │   │   ├── config.ts             ← App / Auth / Firestore / Storage init
│   │   │   ├── persistence.ts(.web)  ← AsyncStorage vs localStorage sessions
│   │   │   └── google-signin.ts(.web)← expo-auth-session vs popup
│   │   ├── api/client.ts             ← Firestore CRUD + realtime subscriptions
│   │   ├── hooks/use-cafes.ts        ← useCafes() / useCafe() live hooks
│   │   ├── context/AuthContext.tsx   ← Global auth state
│   │   ├── components/CafeForm.tsx   ← Shared add/edit form
│   │   ├── theme.ts                  ← Colors, spacing, fonts
│   │   └── utils/storage/            ← Secure storage helper
│   │
│   ├── assets/                       ← Icons, splash
│   ├── app.json                      ← Expo config + permissions
│   ├── package.json
│   ├── .env.example                  ← Template for the values below
│   └── .env                          ← EXPO_PUBLIC_FIREBASE_*, etc.
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
- A **Firebase project** with Firestore, Storage and Authentication enabled
- **Expo Go** app installed on your phone (for testing on device)

**[RUNNING.md](RUNNING.md) is the full setup runbook** — CLI login, registering the
iOS and Web apps, enabling providers, deploying rules, and filling in `.env`. The
short version:

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use my-cafe-journal
npx -y firebase-tools@latest deploy --only auth,firestore,storage

cp frontend/.env.example frontend/.env    # then fill it in
cd frontend && yarn install
```

### Run it

```bash
./dev-up.sh          # Expo web on :1101
# or, by hand:
cd frontend && yarn start
```

Scan the QR code in **Expo Go** or open the web preview in your browser.

---

## Environment Variables

All config lives in `frontend/.env` — see [`frontend/.env.example`](frontend/.env.example).

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | `<project-id>.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Cloud Storage bucket for café photos |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Project number |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Web app ID |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth client — used by `yarn web` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth client — used by expo-auth-session on iOS |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth client — used by expo-auth-session on Android |
| `EXPO_PACKAGER_PROXY_URL`, `EXPO_PACKAGER_HOSTNAME` | Set automatically by the dev environment — **do not modify** |

> **None of these are secrets.** They're public client identifiers; access control
> lives entirely in `firestore.rules` and `storage.rules`. `.env` is still gitignored
> so each developer points at their own project.

Fetch the Firebase values with:

```bash
npx -y firebase-tools@latest apps:sdkconfig WEB --project my-cafe-journal
```

---

## Data Access

There is no REST API. `frontend/src/api/client.ts` talks to Firestore directly and
exposes two flavours of access.

### Realtime (preferred)

```ts
import { useCafes, useCafe } from "@/src/hooks/use-cafes";

const { cafes, loading, error } = useCafes();   // live list, newest first
const { cafe, loading } = useCafe(id);          // live single café, null once deleted
```

Both wrap Firestore `onSnapshot`, so screens re-render on any change — local,
remote, or from another device — with no refetch and no focus listener.

### One-shot

```ts
import { api, computeStats } from "@/src/api/client";

await api.listCafes();              // Cafe[]
await api.getCafe(id);              // Cafe
await api.createCafe(input);        // uploads photos, returns the created Cafe
await api.updateCafe(id, partial);  // uploads new photos, deletes removed ones
await api.deleteCafe(id);           // deletes the doc and its Storage folder
computeStats(cafes);                // the old /api/stats aggregation, client-side
```

### Photos

`CafeForm` still produces `data:image/jpeg;base64,...` URIs. On save, `client.ts`
uploads each one to Cloud Storage and stores only the download URL — Firestore
documents cap at **1 MiB**, which a single phone photo can exceed on its own.

---

## Data Model

Ownership is the document path, not a field. There is no `users` collection to
maintain — Firebase Authentication owns identity.

### `users/{uid}/cafes/{cafeId}`

```js
{
  name: "Blue Bottle",
  created_at: Timestamp,                    // server-generated, set once
  photos: ["https://firebasestorage.../migrated-0.jpg"],
  location_link: "https://maps.app.goo.gl/abc",
  address: "Brooklyn, NY",
  notes: "...",
  rating: 5,                                // 0–5
  favorite_drink: "Iced oat latte",
  visited_date: "2026-02-10",               // YYYY-MM-DD, for month grouping
  tags: ["cosy"],
  latitude: 40.7, longitude: -73.9,         // or null
  price_min: 5, price_max: 9, price_currency: "USD",   // or null
  recommended_menu: [],
  facilities: ["wifi"],
  hospitality: 4                            // 0 = unset
}
```

### Cloud Storage

```
users/{uid}/cafes/{cafeId}/{timestamp}-{index}.jpg
```

**Conventions:**
- Firestore's auto-generated document ID is the café's `id` — no separate UUID field
- `created_at` is a server `Timestamp`; rules pin it so an update can't move it
- The client converts it to an ISO string on read, so `Cafe.created_at` stays a `string`
- Photos are Storage download URLs — never inline base64

---

## Authentication Flow

```
1. User signs in with Email/Password or Google (expo-auth-session on device,
   signInWithPopup on web)
2. Firebase persists the session — AsyncStorage on native, localStorage on web
3. onAuthStateChanged in AuthContext publishes the user on boot and on every change
4. Firestore and Storage requests carry the Firebase ID token automatically
5. firestore.rules / storage.rules scope every path to request.auth.uid
```

Isolation is enforced by the security rules on Google's side, not by client-side
query filtering — a signed-in user cannot read another user's cafés even with a
hand-crafted request.

**The rules are prototype rules.** They're designed to be secure for a
single-user-owns-their-own-data journal: every path is scoped to `request.auth.uid`,
writes are shape- and range-validated, and everything else is denied by default.
Review and verify them before sharing the app broadly.

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
# Frontend Metro bundler
cd frontend && yarn start

# Lint + typecheck
cd frontend && yarn lint && npx tsc --noEmit

# Deploy rule / provider changes
npx -y firebase-tools@latest deploy --only firestore,storage
npx -y firebase-tools@latest deploy --only auth

# Inspect the data
open "https://console.firebase.google.com/project/my-cafe-journal/firestore"

# List registered apps (iOS / Web) and re-fetch their config
npx -y firebase-tools@latest apps:list --project my-cafe-journal
npx -y firebase-tools@latest apps:sdkconfig WEB --project my-cafe-journal
```

Always invoke the CLI via `npx -y firebase-tools@latest` so it stays current.

### Code conventions

- Access control lives in `firestore.rules` / `storage.rules`, never in client filtering
- Platform splits use Metro's `.web.ts` suffix (see `src/firebase/`, `src/utils/storage/`)
- All env values come from `.env` files — never hardcoded
- Every interactive UI element has a `testID` (kebab-case, by role)
- React Native primitives only (no HTML/CSS files); styles via `StyleSheet.create()`

---

## Deployment

There's no server to deploy — only rules and client builds.

1. **Rules and providers:** `npx -y firebase-tools@latest deploy --only auth,firestore,storage`
2. **Authorized domains:** add your production host under Authentication → Authorized
   domains (no protocol, no port) or Google Sign-in will fail on web
3. **iOS/Android binaries:** build with EAS (`eas build`). The Apple app is already
   registered in Firebase against `com.christopherjtp.cafejournal`
4. **Review the security rules before opening the app up** — see
   [Authentication Flow](#authentication-flow)

---

## Roadmap

Ideas worth building next:

- **Year-in-Café recap** — auto-generated shareable image collage (top cafés, drinks, stats)
- **Tags & categories** — espresso bar / cosy / work-friendly
- **Favourites & wishlist** — places you want to visit
- **Social** — follow friends and see their café feeds
- **Forgot-password flow** — `sendPasswordResetEmail` from the Firebase Auth SDK
- **Sign in with Apple** — required by App Store review once other social logins ship
- **Offline mode** — Firestore persistent cache (memory-only on React Native today)
- **Real map view** — render pins on an actual map (needs Google/Mapbox API key)

---

## Credits

This project was built with the help of **[Emergent AI](https://emergent.sh)** — a full-stack AI coding agent that assisted across the entire build:

- 🗣 **Requirement gathering** — interactive scoping of features, integrations, and design choices
- 🎨 **Design system** — generated the warm earthy theme + design guidelines
- 🛠 **Backend scaffolding** — the original FastAPI + MongoDB server and JWT auth,
  since replaced by Firebase (see the git history for `backend/`)
- 📱 **Mobile UI** — Expo Router file-based routing, screens, forms, navigation
- 🧪 **Automated testing** — 27/27 backend integration tests passed on first run
- 🔒 **Deployment health checks** — secret scanning, env validation, query optimization

If you want to build your own full-stack mobile app like this, give Emergent a try at [emergent.sh](https://emergent.sh).

---

## License

Private project. All rights reserved.
