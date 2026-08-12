# Running Café Journal locally

The app talks straight to **Firebase** — Authentication for sign-in, Firestore for
café entries, Cloud Storage for photos. There is no local API or database to run.

All commands assume you're in the project root
(`.../journal-cafe` or the worktree you're using).

The Firebase CLI is always invoked through `npx` so it stays current:

```bash
npx -y firebase-tools@latest --version
```

---

## One-time setup

> **Status on this machine (2026-08-03):** steps 1–7 are **done** against project
> `my-cafe-journal`. Both apps are registered — iOS
> `1:1027531417032:ios:89701d8fae8cfdc413ccfd` (bundle
> `com.christopherjtp.cafejournal`) and Web
> `1:1027531417032:web:2ea9d1364a5f7a2d13ccfd`. Email/Password and Google are
> enabled, Firestore rules are live, and `frontend/.env` is filled in.
>
> **Two things remain:** Cloud Storage isn't provisioned (see step 5b), and the
> `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` values in `.env` are still blank (step 6).
> The steps below are kept for setting the project up from scratch elsewhere.

### 1. Sign in to Firebase

```bash
npx -y firebase-tools@latest login
```

On a machine with no browser, use `login --no-localhost`.

### 2. Point the CLI at the project

Café Journal uses project number **1027531417032**. Find its project *ID*:

```bash
npx -y firebase-tools@latest projects:list
```

Then select it (this writes `.firebaserc`):

```bash
npx -y firebase-tools@latest use my-cafe-journal
```

### 3. Register the apps

An **Apple (iOS)** app, matching `ios.bundleIdentifier` in `frontend/app.json`, and a
**Web** app, which is what Expo Go and `yarn web` actually load:

```bash
npx -y firebase-tools@latest apps:create IOS "Café Journal iOS" \
  --bundle-id com.christopherjtp.cafejournal --project my-cafe-journal

npx -y firebase-tools@latest apps:create WEB "Café Journal Web" --project my-cafe-journal
```

List them again any time with `apps:list --project my-cafe-journal`.

### 4. Enable sign-in providers

`firebase.json` already declares Email/Password and Google. Deploy it — this also
generates the OAuth clients Google Sign-in needs:

```bash
npx -y firebase-tools@latest deploy --only auth --project my-cafe-journal
```

### 5. Create Firestore and deploy the rules

```bash
npx -y firebase-tools@latest firestore:databases:list --project my-cafe-journal
# if there's no database yet, pick a location and create one:
npx -y firebase-tools@latest firestore:locations --project my-cafe-journal
npx -y firebase-tools@latest firestore:databases:create "(default)" \
  --location <LOCATION> --project my-cafe-journal

npx -y firebase-tools@latest deploy --only firestore --project my-cafe-journal
```

### 5b. Enable Cloud Storage (console — needed for café photos)

The CLI has no bucket-create command, so this one is manual:

1. Open https://console.firebase.google.com/project/my-cafe-journal/storage
2. Click **Get Started**. On projects created after late 2024 this requires the
   **Blaze (pay-as-you-go)** plan — a billing decision, so it's left to you.
3. Then deploy the rules:

```bash
npx -y firebase-tools@latest deploy --only storage --project my-cafe-journal
```

Until this is done, adding a café **without** photos works fine; adding one **with**
photos fails on upload.

`firestore.rules` and `storage.rules` scope every read and write to the signed-in
owner. **Review them before you share the app** — see the note at the end.

### 6. Fill in `frontend/.env`

```bash
cp frontend/.env.example frontend/.env
npx -y firebase-tools@latest apps:sdkconfig WEB --project my-cafe-journal
```

Copy the values into `frontend/.env`. The three `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`
entries come from **Google Cloud Console → APIs & Services → Credentials**, created
by the `deploy --only auth` in step 4.

> `.env` is gitignored. **Create it before starting Metro** — Expo bakes
> `EXPO_PUBLIC_*` vars in at startup, so edits while it's running require a restart.
> None of these values are secrets; access is enforced by the security rules.

### 7. Frontend dependencies

```bash
cd frontend
yarn install
```

---

## Every time

```bash
./dev-up.sh      # Expo web on :1101, with a config sanity check
./dev-down.sh    # stop it
```

Logs land in `.dev-logs/`.

Or by hand:

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

Unlike the old FastAPI setup, the phone no longer needs your Mac's LAN IP —
Firebase is reachable from anywhere.

---

## Building with EAS (expo.dev)

Expo Go covers most of the app, but a **development build** is what you want once
you're exercising Google Sign-In or shipping a build to someone else. This project
is managed / CNG — there is no `ios/` or `android/` directory, EAS runs `prebuild`
in the cloud on every build.

The CLI is always invoked through `npx -y eas-cli@latest`, the same way the
Firebase CLI is.

### 1. Sign in and link the expo.dev project

```bash
cd frontend
npx -y eas-cli@latest login
npx -y eas-cli@latest init --id <project-id-from-expo.dev>
```

Find `<project-id>` on your project's page at
`expo.dev/accounts/<owner>/projects/cafe-journal` → *Project ID*. Passing `--id`
links to the **existing** project; running bare `eas init` would offer to create a
new one.

`init` writes two keys into `app.json`: `expo.owner` (your expo.dev account) and
`expo.extra.eas.projectId`. Commit both — they're how every later command knows
which project this is.

> `app.json`'s `slug` is `cafe-journal` and must match the slug on expo.dev. If
> yours differs, change the `slug` to match rather than renaming the project.

Verify:

```bash
npx -y eas-cli@latest whoami
npx -y eas-cli@latest project:info
```

### 2. Push the `EXPO_PUBLIC_*` values to EAS

`.env` is gitignored, so it is **not** uploaded to cloud builds — and
`src/firebase/config.ts` throws at startup when the Firebase vars are missing. A
build with no env injected installs fine and then crashes on launch. Push the
values to EAS once instead.

**EAS rejects empty values** — `env:push` reads the whole file and fails with
`Variable value can not be empty` / `GraphQL request failed` on the first blank
one. Until the three `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` entries are filled in
(setup step 6), push a filtered copy rather than `.env` itself:

```bash
cd frontend
grep -Ev "^[A-Za-z_][A-Za-z0-9_]*=[[:space:]]*(\"\"|'')?[[:space:]]*$" .env > /tmp/eas.env
cat /tmp/eas.env      # sanity-check: only lines with real values
npx -y eas-cli@latest env:push --path /tmp/eas.env --environment development
npx -y eas-cli@latest env:push --path /tmp/eas.env --environment preview
rm /tmp/eas.env
```

Choose visibility **plain** when prompted. These are public client identifiers,
not secrets — and EAS refuses to inject `secret`-visibility variables into a
client bundle anyway. They can also be pasted into the dashboard under
*Project → Environment variables*.

Each build profile in `eas.json` declares the environment it reads
(`development` → development, `preview` → preview), so nothing else needs wiring.

Check it landed:

```bash
npx -y eas-cli@latest env:list --environment preview
```

Six variables is a working state, not a broken one: `src/firebase/config.ts`
only throws on the six `EXPO_PUBLIC_FIREBASE_*` values, so a build with just
those launches and email/password sign-in works. Re-run the push once the Google
client IDs exist — `env:push` updates variables that are already there.

### 3. Build

```bash
cd frontend
yarn build:dev:android        # development build, APK
yarn build:preview:android    # standalone internal build, APK
yarn build:dev:ios            # needs a paid Apple Developer account — see below
```

EAS prints a URL to watch; the finished build is downloadable as a QR code from
the same page. Android needs no account setup — EAS generates and stores a
keystore for you on the first build.

### 4. Run the development build

Install the APK, then start Metro pointed at it:

```bash
cd frontend
yarn start --dev-client       # add -c if the bundle looks stale
```

Open the app and pick your machine from the dev-launcher list (or scan the QR).
Unlike a preview build, JS changes hot-reload — you only rebuild when a native
dependency or an `app.json` native setting changes.

### Known gaps

- **iOS device builds need a paid Apple Developer account** ($99/yr) for ad-hoc
  provisioning. Without one, add `"ios": { "simulator": true }` to a profile in
  `eas.json` and run the result on a macOS Simulator.
- **The three `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` values are still blank** (setup
  step 6). On web that only costs you Google Sign-In — email/password still
  works. On native it is fatal: `AuthProvider` builds the Google auth request at
  launch, so an APK missing those values crashes on startup. Create the OAuth
  clients and push the values before the first native build.
- **No Firebase *Android* app is registered** — only iOS and Web. Android builds
  run, but native Google Sign-In needs an Android OAuth client registered against
  the EAS keystore's SHA-1, which `npx -y eas-cli@latest credentials` prints.
- **Cloud Storage still isn't provisioned** (setup step 5b), so photo upload fails
  in builds exactly as it does locally.

---

## Migrating the old MongoDB data

One-off, for café entries created before the Firebase move. Needs Mongo running
(`docker start journal-mongo`) and `backend/venv/` still present.

```bash
# 1. Export one user's cafés from Mongo
backend/venv/bin/python scripts/export-mongo-cafes.py you@example.com

# 2. Register that email in the app (or sign in with Google), then import
node scripts/import-cafes-to-firestore.mjs cafes-export.json you@example.com 'your-password'
```

The importer signs in as an ordinary user and writes through the real security
rules — no service-account key involved. Base64 photos are uploaded to Cloud
Storage and replaced by download URLs.

Once you've confirmed the data landed, `backend/` and the `journal-mongo`
container can go.

---

## Gotchas

- **Firestore documents cap at 1 MiB**, which is why photos live in Cloud Storage
  rather than inline base64 the way Mongo held them.
- **Google Sign-in on web** needs the serving domain under Authentication →
  Authorized domains. `localhost` is already listed in `firebase.json`; add any
  other host you serve from, **without** protocol or port.
- **Nearby / geocoding is mobile-only** — intentionally disabled on web. Use Expo Go
  on a real device to exercise it.
- **Metro serving stale code?** `yarn start -c` clears the cache.
- **Don't set `CI=1`** when running Metro yourself — it disables hot reload.

---

## Security rules

`firestore.rules` and `storage.rules` are **prototype rules**. They're designed to be
secure for a single-user-owns-their-own-data journal: every path is scoped to
`request.auth.uid`, writes are shape- and range-validated, and everything else is
denied by default. Review and verify them before sharing the app broadly.
