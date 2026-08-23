# AGENTS.md

Guidance for AI assistants working in this repository.

## Overview

Café Journal is an **Expo (React Native) app with no server**. Firebase is the
entire backend: Authentication for sign-in, Cloud Firestore for café entries,
Cloud Storage for photos. There is no REST API to run, mock, or deploy — the
client talks to Firebase directly and access control lives in the security
rules files.

The project was migrated off an earlier FastAPI + MongoDB backend. That
`backend/` directory is gone; `scripts/` holds only the one-off migration. No
code in the tree still references it, but one legacy data field survives from
that era — see [Legacy fields](#legacy-fields).

For Firebase setup (CLI login, registering apps, enabling providers, filling in
`.env`), see **[RUNNING.md](./RUNNING.md)**. For a product-level tour, see
**[README.md](./README.md)**.

## Commands

Everything runs from the repo root unless noted.

```bash
./dev-up.sh          # Expo web on :1101; validates frontend/.env first, logs to .dev-logs/
./dev-down.sh        # stop it

cd frontend
yarn start           # Metro + QR code for Expo Go (required for location features)
yarn start -c        # same, clearing a stale Metro cache
yarn web             # browser only, on :8081

yarn lint            # expo lint
npx tsc --noEmit     # typecheck
```

**`yarn lint && npx tsc --noEmit` is the check pair** — run both before
committing. There is no automated test suite (see [Testing](#testing)).

Yarn 1.22 is pinned via `packageManager` in `frontend/package.json`. Do not use
npm or pnpm.

Rules and provider changes only take effect once deployed:

```bash
npx -y firebase-tools@latest deploy --only firestore,storage
npx -y firebase-tools@latest deploy --only auth
```

Always invoke the Firebase CLI through `npx -y firebase-tools@latest`.

Native builds go through EAS on expo.dev — the project is managed / CNG, so there
is no `ios/` or `android/` directory and prebuild happens in the cloud:

```bash
cd frontend
yarn build:dev:android       # development build (expo-dev-client), APK
yarn build:preview:android   # standalone internal build, APK
yarn start --dev-client      # Metro for an installed development build
```

Same convention as Firebase: the CLI is always `npx -y eas-cli@latest`, never a
local install. `EXPO_PUBLIC_*` values reach cloud builds through EAS environment
variables, not `.env` (which is gitignored and therefore never uploaded) — each
`eas.json` build profile names the environment it reads. See
**[RUNNING.md](./RUNNING.md)** for linking the project and pushing those values.

## Layout

```
firebase.json              Auth providers + rules wiring
firestore.rules            Per-user access + write validation for café docs
storage.rules              Per-user access for photos (10 MiB, image/* only)
dev-up.sh / dev-down.sh    Local dev
design_guidelines.json     Original design brief (reference, not source of truth)
scripts/                   One-off MongoDB → Firestore migration

frontend/
  app/                     Expo Router routes — files here ARE the routes
    _layout.tsx            Root: GestureHandler → SafeArea → Theme → fonts → Auth → Stack
    index.tsx              Splash, then redirects to (tabs) or (auth)/login
    +html.tsx              Web HTML shell
    (auth)/                login, register
    (tabs)/                index (Journal), places, stats, profile
    cafe/                  new, [id] (detail), edit/[id]

  src/                     Everything that is not a route
    api/client.ts          The ONLY module that talks to Firestore/Storage
    hooks/use-cafes.ts     useCafes() / useCafe(id) — live, preferred
    hooks/                 use-app-fonts, use-icon-fonts, use-safe-top
    context/AuthContext.tsx
    firebase/              config.ts, persistence.ts(.web), google-signin.ts(.web)
    theme/                 Light/dark theme system — see below
    components/            CafeForm, GoogleSignInButton, StarPicker
    constants/             currencies, facilities, tags, timezones
    utils/                 distance, geocode, maps, price, storage/(.web)

  app.json                 Expo config, permissions, typedRoutes
  .env                     EXPO_PUBLIC_* — gitignored, see .env.example
  scripts/check-pkg.js     preinstall guard, blocks deprecated packages
```

## Routing

File-based via Expo Router 6. `typedRoutes` is enabled in `app.json`, so route
strings are typechecked.

| File                      | Route                    |
| ------------------------- | ------------------------ |
| `app/index.tsx`           | `/` (splash → redirect)  |
| `app/(auth)/login.tsx`    | `/login`                 |
| `app/(auth)/register.tsx` | `/register`              |
| `app/(tabs)/index.tsx`    | `/` (Journal tab)        |
| `app/(tabs)/places.tsx`   | `/places`                |
| `app/(tabs)/stats.tsx`    | `/stats`                 |
| `app/(tabs)/profile.tsx`  | `/profile`               |
| `app/cafe/new.tsx`        | `/cafe/new`              |
| `app/cafe/[id].tsx`       | `/cafe/<id>`             |
| `app/cafe/edit/[id].tsx`  | `/cafe/edit/<id>`        |

Filename rules: `_layout.tsx` wraps its siblings; `(folder)/` is a route group
that adds no URL segment; `[param].tsx` is a dynamic segment read with
`useLocalSearchParams()`.

Imports use the `@/*` alias, which maps to `frontend/` — e.g.
`import { useCafes } from "@/src/hooks/use-cafes"`.

## Data layer

`src/api/client.ts` is the only module that touches Firestore or Storage. Keep
it that way — screens import hooks or `api`, never `firebase/firestore` itself.

**Prefer the live hooks.** Firestore pushes every change, so screens using them
never refetch on focus and never need a manual refresh:

```ts
const { cafes, loading, error } = useCafes();   // newest first
const { cafe, loading } = useCafe(id);          // null once deleted anywhere
```

One-shot access exists for imperative flows (`api.listCafes`, `api.getCafe`,
`api.createCafe`, `api.updateCafe`, `api.deleteCafe`). `computeStats(cafes)`
does client-side what the old `/api/stats` endpoint did server-side.

Two constraints that shape this file:

- **Photos never go in Firestore.** The picker produces
  `data:image/jpeg;base64,...` URIs and a Firestore document caps at 1 MiB — a
  single phone photo can exceed that alone. `uploadPhotos` writes each one to
  Cloud Storage and the document keeps only the download URL. Already-uploaded
  `https` URLs pass through untouched.
- **Firestore rejects `undefined` outright.** `stripUndefined` guards every
  write; optional fields are typed `?: T | null` and should be written as
  `null`, not omitted-as-undefined.

## Data model

`users/{uid}/cafes/{cafeId}` — **ownership is the document path, not a field.**
There is no `users` collection to maintain; Firebase Authentication owns
identity. Photos live at `users/{uid}/cafes/{cafeId}/{timestamp}-{index}.jpg`.

The Firestore auto-generated document ID is the café's `id`. `created_at` is a
server `Timestamp`, set once and pinned by the rules; the client converts it to
an ISO string on read so `Cafe.created_at` is always a `string`.

### Adding or changing a café field: four coordinated edits

Miss any one and it fails at runtime, often unhelpfully:

1. `CafeInput` / `Cafe` in `src/api/client.ts` — the types.
2. The `fromDoc` default in the same file — without it, cafés written before
   the field existed fail to deserialize.
3. `src/components/CafeForm.tsx` — the shared add/edit form.
4. `isValidCafe` in `firestore.rules`, **then redeploy the rules.** The rules
   validate on create *and* update, and anything not explicitly permitted is
   denied. Skipping this makes every write fail with a *permission* error, which
   looks nothing like the validation error it actually is.

## Auth

`src/context/AuthContext.tsx` exposes `useAuth()`. `onAuthStateChanged` is the
single source of truth — it fires once on boot with the persisted session (or
null) and again on every sign-in/out. `friendlyAuthError` maps Firebase codes
like `auth/invalid-credential` to user-facing copy; add to that map rather than
rendering raw Firebase messages.

Sessions persist automatically: AsyncStorage on native, localStorage on web.

**Platform splits use Metro's `.web.ts` suffix** — write both halves or the web
build breaks:

- `src/firebase/google-signin.ts` (expo-auth-session) / `.web.ts` (popup)
- `src/firebase/persistence.ts` / `.web.ts`
- `src/utils/storage/index.ts` / `.web.ts`
- `src/theme/preference-boot.ts` / `.web.ts`

## Theme & styling

This is the easiest part of the codebase to get wrong. `src/theme/` is a full
light/dark system; import everything from `@/src/theme`.

```ts
import { FONTS, RADII, themedStyles, useTheme, useThemedStyles, type Theme } from "@/src/theme";

const { colors, shadows, raisedOutline } = useTheme();
const styles = useThemedStyles(makeStyles);

// Module level, NOT inline:
const makeStyles = themedStyles((t: Theme) => ({
  card: { backgroundColor: t.colors.surface, borderRadius: RADII.card, ...t.shadows.card },
}));
```

Rules:

- **Style factories must be module-level and wrapped in `themedStyles(...)`.**
  The wrapper exists for contextual typing (without it, `flexDirection: "row"`
  widens to `string` and fails the constraint). The module-level identity is
  what makes the `WeakMap` cache work — `useThemedStyles` keys on
  (factory, theme), and since exactly two frozen `Theme` identities exist for
  the app's lifetime, each StyleSheet is built at most twice in total. An inline
  factory allocates a new stylesheet per component instance per render.
- **Never hardcode a color.** Every color needs an entry in both `LIGHT` and
  `DARK` in `palette.ts`. The palette keys are documented by role
  (`surface` vs `surfaceSecondary` vs `surfaceSunken`) — read the comments there
  before adding one.
- **Scheme-invariant values live in `tokens.ts`** (`RADII`, `FONTS`), not on the
  `Theme`. That keeps the theme honest about what actually varies.
- `raisedOutline` spreads alongside a shadow on raised surfaces: empty in light,
  a hairline border in dark where shadows can't carry elevation.
- `useTheme()` is for colors; `useThemeMode()` (the Light/Dark/System control)
  is used only on Profile. The contexts are split deliberately so the control
  object changing can't re-render the whole app.
- `design_guidelines.json` is the original Tailwind-flavored, light-only design
  brief. It is historical reference — `src/theme/` is the source of truth.

## Conventions

- **React Native primitives only.** No HTML, no CSS files, no styling
  libraries. Styles come from `StyleSheet.create` via `useThemedStyles`.
- **Every interactive element gets a `testID`** — kebab-case, named by role:
  `form-name-input`, `detail-edit-button`, `login-submit-button`. There are
  ~53 in use; match the existing naming.
- **TypeScript `strict` is on.**
- **Config comes only from `EXPO_PUBLIC_*` in `frontend/.env`.** Never hardcode
  Firebase values. None of them are secrets — they are public client
  identifiers — but `.env` stays gitignored so each developer points at their
  own project.
- **Access control belongs in `firestore.rules` / `storage.rules`**, never in
  client-side query filtering. A signed-in user cannot read another user's
  cafés even with a hand-crafted request, and that must remain true.
- Commit messages are imperative sentence case, describing the behavior change:
  "Stop the journal filter row collapsing when the grid is full".

## Gotchas

- **`EXPO_PUBLIC_*` is baked into the bundle at Metro start.** Editing `.env`
  while Metro runs does nothing — restart it.
- **Stale bundle?** `yarn start -c` clears the Metro cache.
- **Don't set `CI=1`** when running Metro — it disables hot reload.
- **`frontend/scripts/check-pkg.js` runs on `preinstall`** and hard-blocks
  `expo-av`, `expo-barcode-scanner`, `expo-background-fetch`, and
  `expo-file-system/legacy`. Use the alternative it names.
- **Geocoding and "Nearby" are mobile-only.** `src/utils/geocode.ts` no-ops on
  web by design; exercise those paths in Expo Go on a real device.
- **Cloud Storage may not be provisioned** on a given Firebase project (it needs
  the Blaze plan). Until it is, cafés without photos save fine and cafés with
  photos fail on upload — see RUNNING.md step 5b.
- **Google Sign-in on web** needs the serving host listed under Authentication →
  Authorized domains, with no protocol or port.

## Testing

There is **no automated test suite**. `tests/` holds an empty `__init__.py` and
`test_reports/` is leftover output from an earlier setup; neither is wired to a
runner.

Verify changes with `yarn lint`, `npx tsc --noEmit`, and by actually driving the
app (Expo Go for anything touching location, photos, or native storage).

`TEST_PLAN.md` is the manual test plan, written against the Firebase
architecture: security rules, realtime propagation, photo upload, client-side
stats, and the UI flows. Its rules and isolation sections (§4.3, §4.7) are the
ones worth running after any change to `firestore.rules` — they can be driven in
the Firebase console's Rules Playground without the app. Its risk register
records known gaps rather than aspirations; keep it current when you close one.

`test_result.md` opens with a protocol block marked DO NOT EDIT OR REMOVE.
Leave it intact.

## Legacy fields

Nothing in the tree still points at the removed FastAPI/MongoDB backend — the
constants files and `README.md` were corrected after the migration. One piece of
history does survive in the data:

- **`location_link` is legacy.** New cafés don't store a pasted Google Maps
  share link; `cafeMapsUrl` in `src/utils/maps.ts` searches Maps by name +
  address instead. The field is still read, and preferred when it holds a safe
  `http(s)` URL, so cafés saved before the change keep opening their original
  link. It remains in `CafeInput`, the form, and `isValidCafe` — don't drop it.
