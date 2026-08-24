# Café Journal — Test Plan

Test plan for the Café Journal app (Expo/React Native + Firebase). Covers
authentication, café CRUD through Firestore, the security rules that enforce
per-user isolation, client-side stats, frontend flows, and a risk register at
the end.

> **This plan was rewritten for the Firebase architecture.** The app previously
> had a FastAPI + MongoDB backend with hand-rolled JWTs, and earlier revisions
> of this document tested REST endpoints, Pydantic 422s, and token forgery. None
> of that exists now: there is no server, no REST API, and no token this codebase
> issues or validates. The client talks to Firebase directly and **the security
> rules are the only access control**.

## 1. Scope

| Area | In scope |
|---|---|
| Auth | register, login, Google sign-in, session persistence, boot routing |
| Café CRUD | create, list, detail, update, delete — via `src/api/client.ts` |
| Security rules | `firestore.rules` write validation; per-user isolation; `storage.rules` |
| Realtime | `onSnapshot` propagation across devices/tabs |
| Photos | Cloud Storage upload, orphan cleanup, size/type limits |
| Stats | `computeStats` totals, averages, top drink, monthly grouping |
| Frontend | journal, places, stats, profile, form, detail, auth screens |
| Non-functional | rules posture, unbounded reads, error surfacing |

Out of scope: push notifications, deployment/CI, EAS builds.

## 2. Test environment / global preconditions

- A Firebase project with **Authentication** (Email/Password + Google),
  **Cloud Firestore**, and **Cloud Storage** enabled. See
  [RUNNING.md](./RUNNING.md).
- **Rules deployed.** Most write-validation cases below fail meaninglessly if
  `firestore.rules` on the project is stale:
  `npx -y firebase-tools@latest deploy --only firestore,storage`
- `frontend/.env` filled in. `EXPO_PUBLIC_*` is baked in at Metro start —
  restart after editing.
- Frontend running: `cd frontend && yarn start` (Expo Go) or `yarn web`.
- Two accounts **User A** and **User B** where isolation is tested.
- **Cloud Storage requires the Blaze plan.** Provisioned on `my-cafe-journal`
  since 2026-08-24, so §4.6 is runnable there. On a project where it isn't, cafés
  without photos save fine and cafés with photos fail on upload — treat §4.6 as
  blocked rather than failing, and TC-PHOTO-06 as the case that covers it.

### Tooling note

There is **no automated test suite** in this repo, so these are manual cases.
Two mechanical aids are worth knowing:

- Rules cases (§4.3, §4.7) can be driven in the Firebase console's **Rules
  Playground** without touching the app.
- They could also be automated with `@firebase/rules-unit-testing` against the
  emulator. That is **not currently set up** — treat it as a suggestion, not a
  precondition.

## 3. Conventions

- **BDD steps** use Given / When / Then.
- Firebase Auth surfaces failures as `auth/*` codes. The client maps them
  through `friendlyAuthError` (`src/context/AuthContext.tsx`); expected copy
  below is the **mapped** string, since that is what a user sees.
- **A rules rejection is a permission error, not a validation error.** Firestore
  returns `permission-denied` whether the write was unauthorised *or* merely
  malformed. Expect that code for every failed write in §4.3 — the distinction
  between "not yours" and "wrong shape" is not observable from the client.
- Cross-user reads fail with `permission-denied` rather than a "not found".
  Existence is not leaked, but the code differs from the old REST 404.

---

## 4. Test cases

### 4.1 Authentication — Registration

---
**TC-AUTH-01 — Register with valid credentials**
- **Precondition:** `new@example.com` is not registered.
- **Objective:** A new user can register and lands signed in.
- **Type:** Positive
- **Steps:**
  - Given `new@example.com` has no Firebase Auth account
  - When I submit the register form with a valid email, a 6+ char password, and a non-empty name
  - Then `createUserWithEmailAndPassword` succeeds and `updateProfile` sets the display name
- **Expected:** Routed into `(tabs)`; Profile shows the name and email. **No `users` collection document is created** — Firebase Authentication owns identity and ownership is the café document path.

---
**TC-AUTH-02 — Register with an already-used email**
- **Precondition:** `taken@example.com` already registered.
- **Objective:** Duplicate emails are refused with readable copy.
- **Type:** Negative
- **Expected:** `auth/email-already-in-use` → `"An account with that email already exists."` in `register-error`.

---
**TC-AUTH-03 — Email casing is normalised by Firebase**
- **Precondition:** Registered as `user@example.com`.
- **Objective:** Confirm Firebase treats the address case-insensitively, so no second account is possible.
- **Type:** Negative
- **Steps:**
  - When I register with `USER@EXAMPLE.COM`
- **Expected:** `auth/email-already-in-use`. *(This is Firebase behaviour, not app logic — there is no lowercasing in this codebase.)*

---
**TC-AUTH-04 — Password below minimum length**
- **Precondition:** None.
- **Objective:** Short passwords are blocked client-side before any network call.
- **Type:** Negative
- **Steps:**
  - When I submit a 5-character password
- **Expected:** `"Password must be at least 6 characters."` (`app/(auth)/register.tsx`), **no request sent**. If the client guard were bypassed, Firebase returns `auth/weak-password` → `"Please choose a password of at least 6 characters."`

---
**TC-AUTH-05 — Password at the boundary (exactly 6 chars)**
- **Type:** Positive
- **Expected:** Accepted; registration succeeds.

---
**TC-AUTH-06 — Any empty field**
- **Objective:** Name, email and password are all required client-side.
- **Type:** Negative
- **Expected:** `"Please fill out every field."`; no request sent.

---
**TC-AUTH-07 — Malformed email**
- **Type:** Negative
- **Expected:** `auth/invalid-email` → `"That doesn't look like a valid email address."`

---
**TC-AUTH-08 — Whitespace-only name (edge)**
- **Objective:** Confirm the client trims before validating.
- **Type:** Negative
- **Steps:**
  - When I submit `name = "   "` with a valid email and password
- **Expected:** `!name.trim()` is truthy → `"Please fill out every field."`. Nothing reaches Firebase. *(The old backend accepted a single space because `min_length=1` counted it; that gap is gone with the backend.)*

---
**TC-AUTH-09 — Provider disabled on the project (edge)**
- **Precondition:** Email/Password disabled in the Firebase console.
- **Objective:** A misconfigured project produces actionable copy, not a raw code.
- **Type:** Negative
- **Expected:** `auth/operation-not-allowed` → `"That sign-in method isn't enabled on this Firebase project."`

### 4.2 Authentication — Login, Google, session

---
**TC-LOGIN-01 — Login with valid credentials**
- **Type:** Positive
- **Expected:** Signed in; `onAuthStateChanged` fires; routed to the Journal tab.

---
**TC-LOGIN-02 — Wrong password**
- **Type:** Negative
- **Expected:** `auth/invalid-credential` → `"That email or password isn't right."`

---
**TC-LOGIN-03 — Non-existent email**
- **Objective:** Unknown email is indistinguishable from a wrong password.
- **Type:** Negative
- **Expected:** The same `"That email or password isn't right."` — the map deliberately gives `auth/user-not-found`, `auth/wrong-password` and `auth/invalid-credential` identical copy to avoid user enumeration. **Any divergence here is a defect.**

---
**TC-LOGIN-04 — Empty fields**
- **Type:** Negative
- **Expected:** `"Please enter email and password."` in `login-error`; no request sent.

---
**TC-LOGIN-05 — Too many failed attempts**
- **Objective:** Firebase's own throttling is surfaced readably.
- **Type:** Negative
- **Steps:**
  - When many wrong-password attempts are made in quick succession
- **Expected:** `auth/too-many-requests` → `"Too many attempts. Please try again in a moment."` *(Firebase throttles server-side; the old backend had none — see the risk register.)*

---
**TC-LOGIN-06 — Offline / unreachable Firebase**
- **Type:** Negative
- **Expected:** `auth/network-request-failed` → `"Couldn't reach Firebase. Check your connection."`

---
**TC-GOOG-01 — Google sign-in on device**
- **Precondition:** A development or preview build — **not Expo Go**, which does
  not bundle the native module. `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` set, and a
  Firebase Android app carrying the SHA-1 of the keystore that signed this APK.
- **Objective:** The native Google SDK returns an ID token and Firebase accepts it.
- **Type:** Positive
- **Expected:** Account chooser opens; after picking an account, signed in and
  `Profile` shows the Google display name.

---
**TC-GOOG-02 — Google sign-in dismissed**
- **Objective:** Dismissing the chooser is not an error.
- **Type:** Positive (edge)
- **Expected:** `loginWithGoogle()` resolves **false**; no error copy rendered; user stays on Login.
  Note the SDK reports this as a `{ type: "cancelled" }` **return value**, not a
  rejection; a second tap while the sheet is open rejects with `IN_PROGRESS` and
  is also swallowed.

---
**TC-GOOG-03 — Button disabled when the build can't sign in**
- **Objective:** `googleReady` gates the button.
- **Type:** Positive
- **Expected:** `google-signin-button` is disabled whenever
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is absent, or the app is running under Expo
  Go, or (on iOS) `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is absent. Enabled otherwise
  — there is no asynchronous "request preparing" state any more, so it does not
  flicker from disabled to enabled after mount.

---
**TC-GOOG-06 — Expo Go**
- **Precondition:** `yarn start`, opened in Expo Go.
- **Objective:** A missing native module costs you Google sign-in, not the app.
- **Type:** Negative (environmental)
- **Expected:** App launches normally; `google-signin-button` renders **disabled**;
  email/password sign-in and every other screen work. Expo Go remains the way to
  exercise location and photo features.

---
**TC-GOOG-05 — Native build with no web client ID**
- **Precondition:** Native build where `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is unset.
- **Objective:** A missing client ID costs you Google sign-in, not the app.
- **Type:** Negative
- **Expected:** App launches to Login; `google-signin-button` renders **disabled**;
  email/password sign-in works normally. Regression guard: before the module-level
  check in `useGoogleSignIn`, `expo-auth-session` threw inside `AuthProvider`'s
  first render and the app died at launch. The mechanism changed but the invariant
  did not — `AuthProvider` still calls this hook unconditionally, so it must never
  throw at import or first render.

---
**TC-GOOG-04 — Google sign-in on web from an unauthorized domain**
- **Precondition:** Serving host not listed under Authentication → Authorized domains.
- **Type:** Negative
- **Expected:** Popup flow fails. Add the host (no protocol, no port) to fix. Common first-run stumble.

---
**TC-SESS-01 — Session persists across app restarts**
- **Objective:** Persistence is wired per platform.
- **Type:** Positive
- **Steps:**
  - Given I signed in and fully quit the app
  - When I reopen it
  - Then `onAuthStateChanged` fires on boot with the persisted user
- **Expected:** Lands on Journal without a login screen. AsyncStorage on native, localStorage on web (`src/firebase/persistence.ts(.web)`).

---
**TC-SESS-02 — Signed-out boot routes to Login**
- **Type:** Positive
- **Steps:**
  - Given no persisted session
  - When the app boots
  - Then `onAuthStateChanged` fires once with `null`
- **Expected:** `splash-loading` while `loading` is true, then redirect to `/(auth)/login`.

---
**TC-SESS-03 — Logout clears the session**
- **Type:** Positive
- **Expected:** `logout-button` → `signOut` → redirect to Login; a restart does not restore the session.

---
**TC-SESS-04 — Display name after email/password register (edge)**
- **Objective:** Cover the explicit `setUser` after `updateProfile`.
- **Type:** Positive
- **Steps:**
  - Given I register with a name
  - When registration completes
  - Then the name shows immediately on Profile
- **Expected:** Name present without a reload. `updateProfile` does **not** re-fire `onAuthStateChanged`, so `AuthContext` publishes the user itself; a regression here shows as a blank/derived name until restart.

### 4.3 Firestore rules — write validation

Every case: authenticated as User A, writing to `users/{A.uid}/cafes`. A rejection
surfaces as **`permission-denied`**, never a field-level message.

---
**TC-RULE-01 — Create with all fields**
- **Type:** Positive
- **Expected:** Write succeeds; document ID becomes the café's `id`; `created_at` is a server `Timestamp`.

---
**TC-RULE-02 — Create missing a required key**
- **Objective:** `hasAll` covers the ten required fields.
- **Type:** Negative
- **Steps:**
  - When a write omits any of `name`, `created_at`, `photos`, `location_link`, `address`, `notes`, `rating`, `favorite_drink`, `visited_date`, `tags`
- **Expected:** `permission-denied`.

---
**TC-RULE-03 — Empty name**
- **Type:** Negative
- **Expected:** `permission-denied` (`name.size() > 0`).

---
**TC-RULE-04 — Name over 200 chars**
- **Type:** Negative
- **Expected:** `permission-denied`. Boundary: exactly 200 succeeds, 201 fails.

---
**TC-RULE-05 — Rating out of range or non-integer**
- **Type:** Negative
- **Steps:**
  - When `rating` is `-1`, `6`, or `4.5`
- **Expected:** `permission-denied` for each (`is int`, `>= 0`, `<= 5`). Boundary: 0 and 5 succeed.

---
**TC-RULE-06 — Notes over 20000 chars**
- **Type:** Negative
- **Expected:** `permission-denied`.

---
**TC-RULE-07 — List caps**
- **Objective:** Each list cap is enforced independently.
- **Type:** Negative
- **Steps:**
  - When `photos` > 20, `tags` > 20, `facilities` > 20, or `recommended_menu` > 50
- **Expected:** `permission-denied` for each. `MAX_TAGS` in `src/constants/tags.ts` mirrors the tags cap — raising one without the other breaks writes.

---
**TC-RULE-08 — Coordinates out of range**
- **Type:** Negative
- **Steps:**
  - When `latitude` is outside -90..90 or `longitude` outside -180..180
- **Expected:** `permission-denied`. Explicit `null` is accepted (the field is optional).

---
**TC-RULE-09 — Price currency format**
- **Type:** Negative
- **Steps:**
  - When `price_currency` is `"usd"`, `"US"`, or `"USDD"`
- **Expected:** `permission-denied` (`^[A-Z]{3}$`). `"USD"` and `null` succeed.

---
**TC-RULE-10 — `created_at` cannot move on update**
- **Objective:** The pin holds against a client that tries to rewrite it.
- **Type:** Negative
- **Steps:**
  - Given café X exists with a server `created_at`
  - When an update sends a different `created_at`
- **Expected:** `permission-denied`; stored value unchanged. This is what keeps list ordering stable.

---
**TC-RULE-11 — Update is validated like a create**
- **Objective:** A partial update can't leave a document the app can't read back.
- **Type:** Negative
- **Steps:**
  - When an update sets `rating = 9` on an otherwise valid café
- **Expected:** `permission-denied`. Rules run `isValidCafe` on **create and update** — a "valid patch, invalid result" write is refused.

---
**TC-RULE-12 — Writing outside the cafés path**
- **Objective:** Default-deny covers everything unmatched.
- **Type:** Negative
- **Steps:**
  - When a write targets `users/{A.uid}` directly, or any other collection
- **Expected:** `permission-denied`.

---
**TC-RULE-13 — Adding a field without redeploying rules (edge / process)**
- **Objective:** Reproduce the failure mode that looks like an auth bug.
- **Type:** Negative (expected-to-expose-trap)
- **Steps:**
  - Given a new café field is added to `CafeInput` and `CafeForm` but **not** to `isValidCafe`
  - When any café is saved
  - Then the rules reject the now-unknown shape
- **Expected:** **Every write fails with `permission-denied`**, which reads as a sign-in problem rather than a validation one. The fix is deploying the rules. See RISK-04.

### 4.4 Café — Create

---
**TC-CAFE-01 — Create with all fields**
- **Precondition:** Authenticated User A.
- **Type:** Positive
- **Expected:** Document written under `users/{A.uid}/cafes/{auto-id}`; `created_at` server-generated; returned `Cafe.id` is the document ID. No `user_id` field — **ownership is the path**.

---
**TC-CAFE-02 — Create with minimal input**
- **Objective:** `fromDoc` defaults fill everything absent on read-back.
- **Type:** Positive
- **Expected:** `photos=[]`, strings `""`, `rating=0`, `tags=[]`, `facilities=[]`, `recommended_menu=[]`, `hospitality=0`, nullable numbers `null`.

---
**TC-CAFE-03 — Empty name is blocked client-side**
- **Type:** Negative
- **Expected:** `"Please give your café a name."` in `form-error`; no write attempted. (The rules would also refuse it — see TC-RULE-03.)

---
**TC-CAFE-04 — Price validation in the form**
- **Type:** Negative
- **Steps:**
  - When min or max is negative/non-numeric → `"Price must be a number of 0 or more."`
  - When max < min → `"Maximum price can't be lower than the minimum."`
  - When the currency isn't 3 letters → `"Enter a 3-letter currency code (e.g. EUR) for the price."`
- **Expected:** Each blocks the save with the quoted copy.

---
**TC-CAFE-05 — `undefined` never reaches Firestore**
- **Objective:** Cover `stripUndefined`.
- **Type:** Positive (regression guard)
- **Steps:**
  - When an optional field is left unset
- **Expected:** The key is omitted or written as `null`, never `undefined`. Firestore **rejects `undefined` outright**, so a regression here throws at write time rather than storing a bad value.

---
**TC-CAFE-06 — `created_at` local echo before the server timestamp lands (edge)**
- **Objective:** Cover the `fromDoc` fallback.
- **Type:** Positive
- **Steps:**
  - Given a café was just created
  - When the local snapshot fires before the server `Timestamp` resolves
  - Then `created_at` reads as `null` and `fromDoc` substitutes "now"
- **Expected:** The new café sorts to the top rather than jumping position when the server value arrives.

---
**TC-CAFE-07 — Create while signed out**
- **Type:** Negative
- **Expected:** `requireUid()` throws `"You need to be signed in to do that."` before any network call.

### 4.5 Café — Read, realtime, update, delete

---
**TC-READ-01 — List returns only the caller's cafés, newest first**
- **Type:** Positive
- **Expected:** `orderBy("created_at", "desc")`; only documents beneath the caller's UID are reachable at all.

---
**TC-READ-02 — List returns full photo arrays**
- **Objective:** Confirm the old cover-photo projection is gone.
- **Type:** Positive
- **Steps:**
  - Given a café with 3 photos
  - When the journal list loads
- **Expected:** All 3 URLs present. The `$slice: 1` projection was a MongoDB optimisation for inline base64; Firestore stores only short download URLs, so the list carries them all.

---
**TC-READ-03 — Empty list for a new user**
- **Type:** Positive
- **Expected:** `[]`, `loading` false, no error.

---
**TC-LIVE-01 — Edits propagate without a refresh**
- **Objective:** The core realtime guarantee.
- **Type:** Positive
- **Steps:**
  - Given the same account is open on two devices (or two browser tabs)
  - When a café is edited on one
  - Then `onSnapshot` pushes to the other
- **Expected:** The second updates **with no refetch, no pull-to-refresh, and no focus listener**. There is deliberately no refresh control anywhere in the app.

---
**TC-LIVE-02 — Deleting a café being viewed elsewhere**
- **Objective:** `useCafe` reports deletion rather than showing a stale café.
- **Type:** Positive (edge)
- **Steps:**
  - Given device 1 sits on café X's detail screen
  - When device 2 deletes X
- **Expected:** `useCafe` yields `cafe === null`; the detail screen handles it without crashing.

---
**TC-LIVE-03 — Listener torn down on unmount**
- **Objective:** No leaked subscriptions.
- **Type:** Positive
- **Expected:** The unsubscribe returned by `subscribeCafes`/`subscribeCafe` runs on unmount and on UID change; signing out does not leave a listener firing against a signed-out UID.

---
**TC-UPD-01 — Partial update leaves other fields intact**
- **Type:** Positive
- **Expected:** Only supplied keys change.

---
**TC-UPD-02 — Editing without touching photos**
- **Objective:** Already-uploaded URLs pass through untouched.
- **Type:** Positive
- **Steps:**
  - When an edit saves with the existing `https://firebasestorage...` URLs
- **Expected:** No re-upload, no duplicate objects, URLs unchanged.

---
**TC-DEL-01 — Delete an owned café**
- **Type:** Positive
- **Expected:** Document removed; the café disappears from every live listener; the detail screen navigates back.

---
**TC-DEL-02 — Delete removes the café's Storage objects**
- **Objective:** Cover the read-then-delete ordering.
- **Type:** Positive
- **Steps:**
  - Given café X has 2 photos
  - When X is deleted
- **Expected:** Both objects removed. The photo URLs are read **before** the document is deleted; deleting objects individually is required because the rules deliberately don't grant `list` on the prefix.

---
**TC-DEL-03 — Storage cleanup failure doesn't fail the delete (edge)**
- **Objective:** Cover the best-effort cleanup.
- **Type:** Positive
- **Steps:**
  - Given an object is already gone (or was never a Storage URL)
  - When the café is deleted
- **Expected:** Delete still succeeds; the failure is swallowed. Trade-off: an orphaned object is preferred over a failed user action. See RISK-05.

### 4.6 Photos

---
**TC-PHOTO-01 — Picked photos upload to Storage, not Firestore**
- **Objective:** The central storage constraint.
- **Type:** Positive
- **Steps:**
  - Given photos picked as `data:image/jpeg;base64,...`
  - When the café is saved
- **Expected:** Each uploads to `users/{uid}/cafes/{cafeId}/{timestamp}-{index}.jpg`; the **document holds only download URLs**. A Firestore document caps at 1 MiB, which a single phone photo can exceed on its own.

---
**TC-PHOTO-02 — Photos are filed under the café's own ID**
- **Objective:** Cover the create-then-patch ordering.
- **Type:** Positive
- **Expected:** The document is created first (with `photos: []`) so uploads can use its ID, then patched with the URLs. Keeps cleanup to a single folder.

---
**TC-PHOTO-03 — Removing a photo during an edit deletes the object**
- **Type:** Positive
- **Steps:**
  - Given café X has 3 photos
  - When an edit saves with only 2 of them
- **Expected:** The dropped object is deleted from Storage; the other two are untouched.

---
**TC-PHOTO-04 — Over-size upload rejected**
- **Objective:** `storage.rules` size cap.
- **Type:** Negative
- **Steps:**
  - When an image ≥ 10 MiB is uploaded
- **Expected:** Rejected by the rules.

---
**TC-PHOTO-05 — Non-image upload rejected**
- **Type:** Negative
- **Expected:** Rejected — `contentType` must match `image/.*`.

---
**TC-PHOTO-06 — Storage not provisioned (environmental)**
- **Precondition:** Cloud Storage not enabled on the project.
- **Type:** Negative (environmental)
- **Expected:** Cafés **without** photos save normally; cafés **with** photos fail on upload. A first-run stumble, not a code defect — see RUNNING.md step 5b.

---
**TC-PHOTO-07 — Media-library permission denied**
- **Type:** Negative
- **Expected:** `"Photo access permission denied."` in `form-error`; no picker opens; no crash.

### 4.7 Multi-user isolation

The rules are the **only** thing enforcing this — there is no server-side filter
and no client-side query narrowing to fall back on. Treat every case here as
release-blocking.

---
**TC-ISO-01 — A cannot read B's cafés**
- **Type:** Negative
- **Steps:**
  - When A subscribes to `users/{B.uid}/cafes`
- **Expected:** `permission-denied`. Not an empty list — the read never lands.

---
**TC-ISO-02 — A cannot read B's café by ID**
- **Precondition:** A knows B's café ID.
- **Type:** Negative
- **Expected:** `permission-denied`.

---
**TC-ISO-03 — A cannot write to B's café**
- **Type:** Negative
- **Expected:** `permission-denied`; B's document unchanged.

---
**TC-ISO-04 — A cannot delete B's café**
- **Type:** Negative
- **Expected:** `permission-denied`; B's café intact.

---
**TC-ISO-05 — A cannot read B's photos**
- **Objective:** Storage is scoped the same way.
- **Type:** Negative
- **Steps:**
  - When A requests an object under `users/{B.uid}/cafes/...`
- **Expected:** Denied. **Note:** a Storage *download URL* carries its own access token, so anyone holding the full URL can fetch that object. The path rules protect enumeration and direct access, not a leaked URL. See RISK-06.

---
**TC-ISO-06 — Stats are inherently per-user**
- **Type:** Positive
- **Expected:** `computeStats` runs over whatever `useCafes` returned, which is only the caller's cafés. There is no cross-user aggregation path to get wrong.

---
**TC-ISO-07 — Isolation holds against a hand-crafted request**
- **Objective:** Prove enforcement isn't client-side.
- **Type:** Negative
- **Steps:**
  - When a request for another user's path is issued outside the app (console, script, Rules Playground)
- **Expected:** Denied. If this ever passes, the rules have regressed regardless of how the app behaves.

### 4.8 Stats

---
**TC-STAT-01 — Aggregates with data**
- **Type:** Positive
- **Expected:** `total_cafes` = count; `average_rating` = mean rounded to 2dp; `top_drink` = most frequent non-empty trimmed drink; `five_star_count` = count of `rating === 5`; `by_month` populated.

---
**TC-STAT-02 — No cafés**
- **Type:** Positive (edge)
- **Expected:** `total_cafes=0`, `average_rating=0`, `top_drink=""`, `five_star_count=0`, `by_month=[]` — no division by zero.

---
**TC-STAT-03 — Blank drinks excluded from the tally**
- **Type:** Positive
- **Steps:**
  - Given 3 cafés with `"Latte"` and 5 with `""` or whitespace
- **Expected:** `top_drink === "Latte"`; blank/whitespace drinks are trimmed out, not counted as a category.

---
**TC-STAT-04 — Malformed `visited_date` silently drops from the chart**
- **Objective:** Expose the total/chart disagreement.
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given a café with `visited_date = "banana"` or `"2026"`
  - When Stats renders
  - Then only dates of length ≥ 7 are grouped
- **Expected (current):** The café counts in `total_cafes` but is **absent from `by_month`**, so the chart and the total disagree with no indication why. See RISK-01.

---
**TC-STAT-05 — "Last 6 months" means last 6 months *with data***
- **Objective:** Expose the misleading label.
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given cafés in Jan–Mar 2025 and then May–Jun 2026 (a long gap)
- **Expected (current):** `by_month` returns the last 6 **populated** months (`slice(-6)`), so months over a year old appear under a "last 6 months" heading. See RISK-02.

---
**TC-STAT-06 — Top-drink tie**
- **Type:** Positive (informational)
- **Steps:**
  - Given `"Latte"` and `"Mocha"` each appear twice
- **Expected:** The sort is stable for a fixed input order, so the result is deterministic per render — but the winner is **not a defined product rule**. Don't assert a specific drink in automation.

### 4.9 Frontend UI flows

---
**TC-UI-01 — Boot with a stored session lands on Journal**
- **Type:** Positive
- **Expected:** `splash-loading` while `loading`, then the Journal tab; no login screen.

---
**TC-UI-02 — Fonts or theme failing doesn't strand the splash**
- **Objective:** Cover the settled-or-errored gate in `app/_layout.tsx`.
- **Type:** Positive (edge)
- **Steps:**
  - Given a font family fails to load
- **Expected:** The app still renders with whatever loaded; the splash hides. A hang here means the gate regressed to requiring success.

---
**TC-UI-03 — Journal search filters name, address and drink**
- **Type:** Positive
- **Expected:** Case-insensitive live filtering via `search-input`.

---
**TC-UI-04 — Journal empty state**
- **Type:** Positive
- **Expected:** `empty-state` when the user has no cafés; `empty-state-no-matches` when a filter excludes everything. The two are distinct — a filter that empties the grid must not read as "you have no cafés".

---
**TC-UI-05 — Tag filtering**
- **Type:** Positive
- **Steps:**
  - When a tag chip is selected
- **Expected:** Only cafés carrying that tag remain; `tag-filter-all` / `clear-filters` restore the full list.

---
**TC-UI-06 — Facility filtering**
- **Type:** Positive
- **Expected:** Selecting facility chips narrows the grid; combined with a tag filter both apply.

---
**TC-UI-07 — Filter row doesn't collapse on a full grid**
- **Objective:** Regression guard for a fixed layout bug.
- **Type:** Positive
- **Expected:** The filter row keeps its height when the grid fills the screen.

---
**TC-UI-08 — Odd-length grid keeps its column width**
- **Objective:** Cover the spacer entry.
- **Type:** Positive
- **Steps:**
  - Given an odd number of cafés
- **Expected:** The trailing polaroid stays one column wide rather than stretching across the row.

---
**TC-UI-09 — "Nearby" sorting (device only)**
- **Precondition:** Expo Go on a real device.
- **Type:** Positive
- **Steps:**
  - When `sort-nearby` is chosen and location permission is granted
- **Expected:** Cafés with coordinates sort by distance. `sort-recent` restores date order.

---
**TC-UI-10 — Location permission denied for "Nearby"**
- **Type:** Negative
- **Expected:** `location-error` shown; the list stays in its previous order; no crash.

---
**TC-UI-11 — "Nearby" and geocoding are no-ops on web**
- **Objective:** Confirm the intentional platform split.
- **Type:** Positive (informational)
- **Expected:** `src/utils/geocode.ts` returns null on web by design. **These paths cannot be exercised in a browser** — use Expo Go.

---
**TC-UI-12 — Café with no photo shows a placeholder**
- **Type:** Positive
- **Expected:** Placeholder icon, not a broken image.

---
**TC-UI-13 — Café form blocks an empty name**
- **Type:** Negative
- **Expected:** `"Please give your café a name."`; no write.

---
**TC-UI-14 — Whitespace-only café name is trimmed then rejected**
- **Type:** Negative
- **Expected:** Same error as TC-UI-13 — `name.trim()` is empty.

---
**TC-UI-15 — Delete: cancel keeps the café**
- **Type:** Positive
- **Steps:**
  - When `detail-delete-button` is tapped and the dialog is dismissed
- **Expected:** Nothing deleted. Native uses `Alert.alert`; **web falls back to `window.confirm`** because Alert buttons are a no-op there — exercise both.

---
**TC-UI-16 — Delete: confirm removes it**
- **Type:** Positive
- **Expected:** Café deleted, navigated back, absent from the journal.

---
**TC-UI-17 — Creating a café navigates to its detail**
- **Type:** Positive
- **Expected:** Detail screen for the new ID.

---
**TC-UI-18 — Editing pre-fills the form**
- **Type:** Positive
- **Expected:** `form-*` inputs seeded with current values, including tags, facilities, price and hospitality.

---
**TC-UI-19 — Places lists cafés with a location or address**
- **Type:** Positive
- **Expected:** `cafes.filter(c => c.location_link || c.address)`; others hidden.

---
**TC-UI-20 — "Open in Google Maps" searches by name + address**
- **Objective:** Cover the replacement for the removed share-link flow.
- **Type:** Positive
- **Steps:**
  - Given a café saved **without** a pasted link
  - When `detail-open-map` is tapped
- **Expected:** Opens `google.com/maps/search/?api=1&query=<name+address>`. Since `name` is always present, the button always has a usable URL and can render unconditionally.

---
**TC-UI-21 — A legacy café still opens its saved link**
- **Type:** Positive (edge)
- **Steps:**
  - Given a café saved before the change, with a real `location_link`
- **Expected:** The saved link is preferred over the search URL.

---
**TC-UI-22 — An unsafe stored link falls back to search**
- **Objective:** Cover `isSafeLink`.
- **Type:** Positive (security regression guard)
- **Steps:**
  - Given `location_link` holds `javascript:alert(1)`, a `file:` path, or any non-http(s) string
  - When the map button is tapped
- **Expected:** The stored value is **ignored** and the name+address search opens instead. The raw string must never reach `Linking.openURL`. *(This was an open risk under the old backend; it is now guarded — keep it that way.)*

---
**TC-UI-23 — Theme: Light / Dark / System**
- **Type:** Positive
- **Steps:**
  - When each mode is chosen on Profile
- **Expected:** Colors switch immediately; System follows the OS setting. The choice persists across restarts.

---
**TC-UI-24 — Status bar contrast follows the resolved scheme**
- **Objective:** Cover the deliberate non-use of `"auto"`.
- **Type:** Positive (edge)
- **Steps:**
  - Given the OS is in dark mode
  - When the in-app theme is set to **Light**
- **Expected:** Dark status-bar glyphs — driven by the resolved scheme, not the OS. `"auto"` would get this backwards.

---
**TC-UI-25 — No hardcoded colors survive a theme switch**
- **Objective:** Catch palette gaps.
- **Type:** Positive
- **Steps:**
  - When switching to Dark
- **Expected:** No element keeps a light-mode color. Any that does is a hardcoded value missing a `LIGHT`/`DARK` palette entry.

---
**TC-UI-26 — Backfill locations**
- **Type:** Positive
- **Steps:**
  - Given cafés with addresses but no coordinates
  - When `backfill-locations-button` is tapped on a device
- **Expected:** Coordinates geocoded and saved; `backfill-result` reports the outcome, including the nothing-to-do case. Mobile-only — geocoding no-ops on web.

---
**TC-UI-27 — Load failure is invisible to the user**
- **Objective:** Expose a real gap.
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given the listener errors (rules rejection, offline, project misconfigured)
  - When the Journal loads
- **Expected (current):** `useCafes` sets `error`, but **no screen reads it** — all four call sites destructure only `cafes`/`cafe` and `loading`. The user sees the empty state, indistinguishable from having no cafés. See RISK-03.

### 4.10 Security & non-functional

---
**TC-SEC-01 — Rules deny by default**
- **Type:** Positive
- **Steps:**
  - When any path outside `users/{uid}/cafes/{cafeId}` is read or written
- **Expected:** Denied by the catch-all `match /{document=**}`.

---
**TC-SEC-02 — Signed-out access is refused**
- **Type:** Negative
- **Expected:** `isOwner` requires `request.auth != null`; unauthenticated reads and writes are denied.

---
**TC-SEC-03 — Unbounded reads**
- **Objective:** Document the absence of a cap.
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given a user with a very large number of cafés
  - When the Journal loads
- **Expected:** `subscribeCafes` applies **no `limit()`** — every café is fetched and held live. The old `to_list(1000)` truncation is gone, so nothing is silently dropped, but reads and memory grow without bound. See RISK-07.

---
**TC-SEC-04 — Config values are public, not secret**
- **Type:** Positive (informational)
- **Steps:**
  - Given `EXPO_PUBLIC_*` values are baked into the bundle and readable by anyone
- **Expected:** This is **expected and safe** — they are public client identifiers. Security rests entirely on the rules. A finding of "API key exposed in the bundle" is not a defect here; a permissive rule is.

---
**TC-SEC-05 — Web session storage**
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given the app runs on web
- **Expected:** Firebase persists the session in localStorage (no Keychain equivalent), so it is reachable by XSS. Acceptable for scope; note before wider release. See RISK-08.

---

## 5. Edge cases & risk register

Rewritten for the Firebase architecture. Risks tied to the old backend — CORS,
login rate limiting, `JWT_SECRET` strength, token revocation, MongoDB's 16 MB
document ceiling, and the `to_list` caps — **no longer exist** and have been
removed rather than renumbered.

| ID | Severity | Issue | Where | Exercised by |
|---|---|---|---|---|
| RISK-01 | **High** | `visited_date` has **no format validation** — the rules only check `is string`. Garbage dates are stored, then silently dropped from the stats chart while still counting in `total_cafes`, so the chart and total disagree. | `isValidCafe`, `computeStats` | TC-STAT-04 |
| RISK-02 | **Medium** | Stats chart is labelled **"Last 6 months"** but returns the last 6 months *containing data* (`slice(-6)`). After an inactive stretch it presents stale months as recent. | `computeStats` / `stats.tsx` | TC-STAT-05 |
| RISK-03 | **Medium** | **Listener errors are invisible.** `useCafes`/`useCafe` expose `error`, but no screen reads it — a rules rejection or offline failure renders as an empty journal. Most likely to bite right after a rules change. | `(tabs)/*`, `cafe/[id].tsx` | TC-UI-27 |
| RISK-04 | **Medium (process)** | Adding a café field without updating `isValidCafe` **and redeploying** makes every write fail with `permission-denied`, which reads as an auth bug rather than a validation one. | `firestore.rules` | TC-RULE-13 |
| RISK-05 | **Low** | Storage cleanup is best-effort: a failed object delete is swallowed, leaving orphaned photos billed against the project. Deliberate — a cleanup failure shouldn't fail the user's action. | `deletePhotos` | TC-DEL-03 |
| RISK-06 | **Low/Med** | Storage **download URLs carry their own access token**, so anyone with the full URL can fetch the photo regardless of the path rules. Fine while URLs stay in the owner's documents; matters if they're ever shared. | `uploadPhotos`, `storage.rules` | TC-ISO-05 |
| RISK-07 | **Medium** | **No pagination.** `subscribeCafes` has no `limit()`, so every café is fetched and held live. Read cost and memory grow linearly with the journal. | `subscribeCafes` | TC-SEC-03 |
| RISK-08 | **Low** | On web the Firebase session lives in localStorage (no Keychain), exposing it to XSS. Acceptable for scope; note for production. | `persistence.web.ts` | TC-SEC-05 |
| RISK-09 | **Low** | Renaming or removing a `FACILITIES` key orphans that value in every café already saved with it; `facilityMeta` returns `undefined` and the chip silently disappears. No migration path. | `constants/facilities.ts` | TC-RULE-07 |

### Resolved since the previous revision

- **`location_link` opened without scheme validation.** `isSafeLink` in
  `src/utils/maps.ts` now restricts stored links to `http(s)` and falls back to
  a name+address search otherwise. Guarded by TC-UI-22 — keep that case.
- **Whitespace-only names accepted by the API.** The permissive Pydantic
  `min_length=1` went with the backend; the client trims (TC-AUTH-08, TC-UI-14).
- **Inline base64 photos near MongoDB's 16 MB ceiling.** Photos now live in
  Cloud Storage with a 10 MiB per-object rule (TC-PHOTO-01, TC-PHOTO-04).
- **Google sign-in on Android moved off `expo-auth-session`.** Google disabled
  custom-URI-scheme redirects for Android OAuth clients, so the browser flow
  failed with `Error 400: invalid_request — Custom URI scheme is not enabled for
  your Android client` and no console setting could re-enable it. Native sign-in
  now goes through `@react-native-google-signin/google-signin`, which returns an
  ID token with no redirect involved (TC-GOOG-01). Web is unchanged.
- **A missing Google OAuth client crashed native builds at launch.**
  `expo-auth-session` throws when the current platform's client ID is
  `undefined`, and `AuthProvider` — which wraps the whole app — called the hook
  unconditionally, so an Android APK died before rendering anything even though
  email/password worked. `useGoogleSignIn` now picks its implementation at module
  load and falls back to a `ready: false` stand-in (TC-GOOG-05).

## 6. Suggested execution order

1. **Rules** (§4.3, §4.7) — the only access control there is, and cheap to
   drive in the Rules Playground. Isolation must pass before any release.
2. **Data layer** (§4.4–4.6, §4.8) — CRUD, realtime, photos, stats.
3. **Frontend flows** (§4.9) — manual, in Expo Go for anything touching
   location, photos or native storage.
4. **Security posture** (§4.10) — mostly one-time checks tracked in the risk
   register.

Before any of it: `cd frontend && yarn lint && npx tsc --noEmit`, and make sure
the rules deployed to the project match the ones in the repo. A stale ruleset
makes §4.3 and §4.7 test something other than what you're reading.
