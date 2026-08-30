---
name: deploy
description: Deploy Firebase security rules/auth config and build native Android apps via EAS for Café Journal. Use when deploying firestore.rules/storage.rules changes, deploying auth provider config, or building/publishing an Android APK.
---

Rules and provider changes only take effect once deployed:

```bash
npx -y firebase-tools@latest deploy --only firestore,storage
npx -y firebase-tools@latest deploy --only auth
```

Always invoke the Firebase CLI through `npx -y firebase-tools@latest`.

Native builds go through EAS on expo.dev. **There is no `android/` or `ios/`
directory** — the project is CNG, so EAS runs `prebuild` for both platforms in
the cloud on every build and `app.json` is the single source of truth for native
config. Both paths are gitignored; if a local `npx expo prebuild` leaves them
behind, delete them rather than committing them.

Building for a **physical iPhone is not currently possible**: every profile is
`distribution: internal`, which on iOS means ad-hoc provisioning and so a paid
Apple Developer account. The EAS workflows build Android only — see RUNNING.md
for how to add iOS back once that account exists.

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
**[RUNNING.md](../../../RUNNING.md)** for linking the project and pushing those values.
