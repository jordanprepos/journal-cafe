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

> **Status on this machine (2026-08-24):** steps 1–7 are **done** against project
> `my-cafe-journal`. Two apps are registered — iOS
> `1:1027531417032:ios:89701d8fae8cfdc413ccfd` (bundle
> `com.christopherjtp.cafejournal`) and Web
> `1:1027531417032:web:2ea9d1364a5f7a2d13ccfd`. Email/Password and Google are
> enabled, Firestore and Storage rules are live, **Cloud Storage is provisioned**
> so café photos upload, and `frontend/.env` is filled in.
>
> **What remains is Google Sign-in on Android:** no Android app is registered
> (step 3), so there is no Android OAuth client and
> `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` is blank (steps 3b and 6). The button is
> disabled on Android builds; email/password works everywhere.
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

One per platform you ship. **Web** is what Expo Go and `yarn web` load; **iOS** and
**Android** must match `ios.bundleIdentifier` and `android.package` in
`frontend/app.json` — both are `com.christopherjtp.cafejournal`.

```bash
npx -y firebase-tools@latest apps:create WEB "Café Journal Web" --project my-cafe-journal

npx -y firebase-tools@latest apps:create IOS "Café Journal iOS" \
  --bundle-id com.christopherjtp.cafejournal --project my-cafe-journal

npx -y firebase-tools@latest apps:create ANDROID "Café Journal Android" \
  --package-name com.christopherjtp.cafejournal --project my-cafe-journal
```

List them again any time with `apps:list --project my-cafe-journal`.

#### 3b. Attach a signing fingerprint to the Android app

Registering the Android app is not enough for Google Sign-in. Google identifies an
Android caller by package name **plus the SHA-1 of the certificate that signed the
APK**, and it only mints an Android OAuth client once a fingerprint exists. Skip
this and step 6's `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` has no value to hold.

Read the fingerprint of the keystore EAS signs with — it generates one on your
first Android build:

```bash
cd frontend
npx -y eas-cli@latest credentials
# Android → the build profile → Keystore: Manage everything… → SHA-1 Fingerprint
```

Attach it:

```bash
npx -y firebase-tools@latest apps:android:sha:create <ANDROID_APP_ID> <SHA1> \
  --project my-cafe-journal
```

If your CLI version lacks that subcommand, use the console: *Project settings →
Your apps → the Android app → Add fingerprint*.

Then read the client ID back out — it is the `oauth_client` entry with
`"client_type": 1`:

```bash
npx -y firebase-tools@latest apps:sdkconfig ANDROID <ANDROID_APP_ID> \
  --project my-cafe-journal
```

That command prints a `google-services.json`. **You don't need the file** — this
app reads its config from `EXPO_PUBLIC_*`, not from `google-services.json`. Only
the client ID matters; it goes in `.env` at step 6.

If no `client_type: 1` entry appears, don't assume the client wasn't created —
`sdkconfig` can lag behind. Check **Google Cloud Console → APIs & Services →
Credentials** on the same project, where it shows as *Android client for
com.christopherjtp.cafejournal*, and copy the ID from there:

https://console.cloud.google.com/apis/credentials?project=my-cafe-journal

Confirm the project picker reads `my-cafe-journal` and not a default *My First
Project* — an empty Credentials page with no API keys means you're in the wrong
project or signed in as the wrong Google account, not that nothing exists.

> **The SHA-1 is per signing key.** This one covers APKs that EAS signs. A Play
> Store release re-signed by Play App Signing has a different fingerprint, which
> has to be added here as a second one — otherwise sign-in works everywhere except
> the store build.

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
photos fails on upload. Both parts matter: with a bucket but no deployed rules the
upload still fails, and it fails as a *permission* error rather than a missing-bucket
one, which reads like a bug in the app.

Check the bucket's name matches `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` in `.env`
(and in the EAS environments). Projects created from late 2024 get
`<project>.firebasestorage.app`; older ones get `<project>.appspot.com`.

`firestore.rules` and `storage.rules` scope every read and write to the signed-in
owner. **Review them before you share the app** — see the note at the end.

### 6. Fill in `frontend/.env`

```bash
cp frontend/.env.example frontend/.env
npx -y firebase-tools@latest apps:sdkconfig WEB --project my-cafe-journal
```

Copy the values into `frontend/.env`. The three `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`
entries are the per-platform OAuth clients — Google verifies a caller differently
on each platform, so they are not interchangeable and only the current platform's
ID is read at runtime:

| Variable | Comes from |
| --- | --- |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `deploy --only auth` (step 4) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | `deploy --only auth` (step 4) |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | the SHA-1 you attached in step 3b |

All three are listed under **Google Cloud Console → APIs & Services →
Credentials** for the same project.

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
you're exercising Google Sign-In or shipping a build to someone else.

The project is CNG: there is no `android/` or `ios/` directory, EAS runs
`prebuild` for both in the cloud on every build, and `app.json` is the single
source of truth for native config. Both paths are gitignored — if a local
`npx expo prebuild` leaves them behind, delete them rather than committing them.
A committed native folder silently wins over `app.json`, which EAS announces
only in passing mid-build:

```
Specified value for "ios.bundleIdentifier" in app.json is ignored because an
ios directory was detected in the project.
```

`npx -y expo-doctor` flags the same thing under *"Check for app config fields
that may not be synced in a non-CNG project"*.

The CLI is always invoked through `npx -y eas-cli@latest`, the same way the
Firebase CLI is.

### 1. Sign in and link the expo.dev project

```bash
cd frontend
npx -y eas-cli@latest login
npx -y eas-cli@latest init --id <project-id-from-expo.dev>
```

Find `<project-id>` on your project's page at
`expo.dev/accounts/<owner>/projects/journal-cafe` → *Project ID*. Passing `--id`
links to the **existing** project; running bare `eas init` would offer to create a
new one.

`init` writes two keys into `app.json`: `expo.owner` (your expo.dev account) and
`expo.extra.eas.projectId`. Commit both — they're how every later command knows
which project this is.

> `app.json`'s `slug` is `journal-cafe` and must match the slug on expo.dev. If
> yours differs, change the `slug` to match rather than renaming the project.
> When they disagree, every `eas` command refuses to run:
>
> ```
> Slug for project identified by "extra.eas.projectId" (journal-cafe) does not
> match the "slug" field (cafe-journal).
> ```
>
> The slug in parentheses is the authoritative one — it is what the `projectId`
> actually resolves to on expo.dev. Copy it into `app.json`.

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

Choose visibility **plaintext** when prompted. These are public client
identifiers, not secrets. The choice matters more than it looks:

| Visibility | Reaches the build? | Listed in the build log? |
| --- | --- | --- |
| `plaintext` | yes | yes |
| `sensitive` | yes | masked |
| `secret` | **no** | no |

A `secret` variable pushes, lists, and looks entirely correct while never
reaching the app — EAS will not inject one into a client bundle.

Each build profile in `eas.json` declares the environment it reads
(`development` → development, `preview` → preview), so nothing else needs wiring.

**For a single variable, set it directly** rather than re-pushing the file.
`env:push` only carries what was in the copy you generated, so a value added to
`.env` after that copy was made is silently missing:

```bash
cd frontend
npx -y eas-cli@latest env:set --scope project --visibility plaintext \
  --environment preview --environment development \
  --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID \
  --value "<the client ID>"
```

> `env:set` replaced `env:create` in eas-cli 22. The old name still runs but
> warns, and it rejects `--visibility plain` — the accepted values are
> `plaintext`, `sensitive`, `secret`.

Check it landed:

```bash
npx -y eas-cli@latest env:list --environment preview
```

Six variables is a working state, not a broken one: `src/firebase/config.ts`
only throws on the six `EXPO_PUBLIC_FIREBASE_*` values, so a build with just
those launches and email/password sign-in works.

**`env:list` is not proof the value reached a build.** The authoritative check is
the build's own log, which names every variable it loaded:

```
Environment variables with visibility "Plain text" and "Sensitive" loaded from
the "preview" environment on EAS: EXPO_PUBLIC_FIREBASE_API_KEY, …
```

If a name is absent there, that APK does not have it, and installing it will
change nothing — `EXPO_PUBLIC_*` is baked in at build time. Check that line
before spending time on the device.

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

### 3b. Building from GitHub (expo.dev dashboard)

The Expo project is **not** at the repo root — `package.json`, `app.json` and
`eas.json` all live in `frontend/`. EAS defaults to cloning the repo and reading
the root, so *Start a build from GitHub* fails immediately with:

```
Failed to read "/package.json".
```

Fix it once on expo.dev: **Project → Settings → GitHub → Base directory**, set to
`/frontend`, then save and retry the build. Nothing in the repo can set this —
it is stored against the GitHub connection.

The same rule applies to EAS Workflows: they are discovered relative to the
project root, so they live in `frontend/.eas/workflows/` — not `.eas/workflows/`
at the repo root, and not `frontend/.eas/` either. There are exactly two:

| File | Trigger | Builds |
| --- | --- | --- |
| `create-preview-builds.yml` | every push to `main` | Android, `preview` profile |
| `create-production-builds.yml` | on demand | Android, `production` profile |

```bash
cd frontend
npx -y eas-cli@latest workflow:run create-production-builds.yml
```

A workflow builds whatever `profile` its jobs name. Omitting `profile` silently
builds `production`, which is the default — so always state it.

**Neither has an iOS job.** Both profiles are `distribution: internal`, which on
iOS means an ad-hoc build, which needs a paid Apple Developer account for the
distribution certificate and provisioning profile. Without one the job dies at
"Resolve build configuration":

```
Failed to set up credentials.
You're in non-interactive mode. EAS CLI couldn't find any credentials suitable
for internal distribution. Run this command again in interactive mode.
```

Workflows always run non-interactive, so this cannot be fixed from inside one.
Once you have a paid account, register devices and generate the credentials from
your own terminal first — after that a workflow can reuse them:

```bash
cd frontend
npx -y eas-cli@latest device:create
npx -y eas-cli@latest build --profile preview --platform ios
```

Then add the job back:

```yaml
  build_ios:
    name: Build iOS App
    type: build
    params:
      platform: ios
      profile: preview
```

If the path is wrong the CLI does not say so — it resolves the argument against
the current directory instead and reports the file it failed to open:

```
ENOENT: no such file or directory, open '.../frontend/preview-builds.yml'
```

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
- **Google Sign-In is unavailable on Android builds.** Of the three
  `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` values only the iOS one is set, and no Firebase
  Android app is registered to generate the Android one — see steps 3, 3b and 6.
  The button renders disabled and email/password is the way in. It is no longer
  fatal: `useGoogleSignIn` checks for the current platform's client ID at module
  load and falls back to a stand-in that reports `ready: false`. Before that guard
  existed, `expo-auth-session` threw during `AuthProvider`'s first render and took
  the whole app down at launch, on a build where everything else worked.

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
