# Café Journal — Test Plan

Test plan for the Café Journal app (Expo/React Native + FastAPI + MongoDB).
Covers the REST API, frontend flows, multi-user isolation, and a dedicated
edge-case / risk register at the end.

## 1. Scope

| Area | In scope |
|---|---|
| Auth | register, login, `/auth/me`, JWT validation, session boot |
| Café CRUD | create, list, detail, update, delete |
| Stats | totals, averages, top drink, monthly grouping |
| Isolation | per-user data separation across every endpoint |
| Frontend | journal, places, stats, profile, form, detail, auth screens |
| Non-functional | input validation, security posture, payload limits |

Out of scope: push notifications, deployment/CI, cloud photo storage (roadmap items).

## 2. Test environment / global preconditions

- Backend running on `http://localhost:8001`, MongoDB reachable (Docker `journal-mongo`).
- `backend/.env` has `MONGO_URL`, `DB_NAME`, `JWT_SECRET`.
- Frontend running via `expo start`; `EXPO_PUBLIC_BACKEND_URL` points at the backend.
- A clean database (or unique random emails per run) to avoid cross-test contamination.
- For UI cases: web browser at `http://localhost:8081` and/or Expo Go on device.
- Two registered accounts **User A** and **User B** exist where isolation is tested.

## 3. Conventions

- **BDD steps** use Given / When / Then.
- Auth endpoints return **422** for schema/validation failures (Pydantic), **400/401** for business-rule failures.
- Protected café endpoints return **404** (not 403) for another user's resource — existence is intentionally not leaked.

---

## 4. Test cases

### 4.1 Authentication — Registration

---
**TC-AUTH-01 — Register with valid credentials**
- **Precondition:** `new@example.com` is not registered.
- **Objective:** A new user can register and receive a token.
- **Type:** Positive
- **Steps:**
  - Given the email `new@example.com` is not in the `users` collection
  - When I POST `/api/auth/register` with a valid email, a 6+ char password, and a non-empty name
  - Then the request completes successfully
- **Expected:** 200; body contains `access_token`, `token_type="bearer"`, and `user{id,email,name}`; `hashed_password` is **not** present; a `users` document is created with `email` lowercased.

---
**TC-AUTH-02 — Register with an already-used email (same case)**
- **Precondition:** `taken@example.com` already registered.
- **Objective:** Duplicate emails are rejected.
- **Type:** Negative
- **Steps:**
  - Given `taken@example.com` already exists
  - When I POST `/api/auth/register` with the same email
  - Then registration is refused
- **Expected:** 400, detail `"Email already registered"`; no second document created.

---
**TC-AUTH-03 — Register with an already-used email (different case)**
- **Precondition:** `user@example.com` already registered.
- **Objective:** Email uniqueness is case-insensitive.
- **Type:** Negative
- **Steps:**
  - Given `user@example.com` already exists
  - When I POST `/api/auth/register` with `USER@EXAMPLE.COM`
  - Then registration is refused because the email is lowercased before comparison
- **Expected:** 400, `"Email already registered"`.

---
**TC-AUTH-04 — Register with password below minimum length**
- **Precondition:** None.
- **Objective:** Passwords shorter than 6 chars are rejected.
- **Type:** Negative
- **Steps:**
  - Given a fresh email
  - When I POST `/api/auth/register` with a 5-character password
  - Then the schema validation fails
- **Expected:** 422; error references `password` / `min_length`; no user created.

---
**TC-AUTH-05 — Register with password at the boundary (exactly 6 chars)**
- **Precondition:** None.
- **Objective:** 6 characters is accepted (boundary).
- **Type:** Positive
- **Steps:**
  - Given a fresh email
  - When I POST `/api/auth/register` with a 6-character password
  - Then registration succeeds
- **Expected:** 200; token returned.

---
**TC-AUTH-06 — Register with empty name**
- **Precondition:** None.
- **Objective:** Name is required (min length 1).
- **Type:** Negative
- **Steps:**
  - Given a fresh email
  - When I POST `/api/auth/register` with `name = ""`
  - Then validation fails
- **Expected:** 422; error references `name`.

---
**TC-AUTH-07 — Register with a malformed email**
- **Precondition:** None.
- **Objective:** Email format is validated.
- **Type:** Negative
- **Steps:**
  - Given a body with `email = "not-an-email"`
  - When I POST `/api/auth/register`
  - Then validation fails
- **Expected:** 422; error references `email` / `value is not a valid email address`.

---
**TC-AUTH-08 — Register with a reserved-TLD email (edge)**
- **Precondition:** None.
- **Objective:** `EmailStr` rejects reserved/special-use domains.
- **Type:** Negative
- **Steps:**
  - Given a body with `email = "smoke@test.local"`
  - When I POST `/api/auth/register`
  - Then validation fails on the reserved TLD
- **Expected:** 422; detail mentions "special-use or reserved name". *(Confirmed live.)*

---
**TC-AUTH-09 — Register with a whitespace-only name (edge)**
- **Precondition:** None.
- **Objective:** Document that the API accepts a single-space name (backend does not `.strip()`).
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given a fresh email
  - When I POST `/api/auth/register` with `name = " "`
  - Then the backend accepts it because `min_length=1` counts the space
- **Expected (current):** 200, user stored with `name=" "`. **Desired:** rejected. See RISK-04.

---
**TC-AUTH-10 — Concurrent duplicate registration (race)**
- **Precondition:** `race@example.com` not registered.
- **Objective:** The unique index prevents a double-insert under a race.
- **Type:** Negative
- **Steps:**
  - Given two registration requests for `race@example.com` fire simultaneously
  - When both pass the pre-insert existence check
  - Then the second insert violates the unique index and is caught
- **Expected:** Exactly one user created; the loser returns 400 `"Email already registered"` (not 500).

### 4.2 Authentication — Login

---
**TC-LOGIN-01 — Login with valid credentials**
- **Precondition:** User A registered.
- **Objective:** Correct credentials return a token.
- **Type:** Positive
- **Steps:**
  - Given User A exists
  - When I POST `/api/auth/login` with A's email and password
  - Then login succeeds
- **Expected:** 200; `access_token` + `user`.

---
**TC-LOGIN-02 — Login with wrong password**
- **Precondition:** User A registered.
- **Objective:** Wrong password is rejected without leaking which field was wrong.
- **Type:** Negative
- **Steps:**
  - Given User A exists
  - When I POST `/api/auth/login` with A's email and a wrong password
  - Then login fails
- **Expected:** 401, `"Incorrect email or password"`.

---
**TC-LOGIN-03 — Login with a non-existent email**
- **Precondition:** `ghost@example.com` never registered.
- **Objective:** Unknown email is rejected with the same generic message.
- **Type:** Negative
- **Steps:**
  - Given no account for `ghost@example.com`
  - When I POST `/api/auth/login`
  - Then login fails identically to a wrong password
- **Expected:** 401, `"Incorrect email or password"` (message must match TC-LOGIN-02 to avoid user enumeration).

---
**TC-LOGIN-04 — Login is case-insensitive on email**
- **Precondition:** Registered as `mixed@example.com`.
- **Objective:** Login works regardless of email casing.
- **Type:** Positive
- **Steps:**
  - Given the account was created with `mixed@example.com`
  - When I POST `/api/auth/login` with `MIXED@EXAMPLE.COM`
  - Then the email is lowercased and matched
- **Expected:** 200; token returned.

---
**TC-LOGIN-05 — Login with missing password field**
- **Precondition:** None.
- **Objective:** Schema requires password.
- **Type:** Negative
- **Steps:**
  - Given a body with only `email`
  - When I POST `/api/auth/login`
  - Then validation fails
- **Expected:** 422.

### 4.3 Session & JWT authorization

---
**TC-JWT-01 — Access a protected route with a valid token**
- **Precondition:** Valid token for User A.
- **Objective:** Valid Bearer token grants access.
- **Type:** Positive
- **Steps:**
  - Given a valid token
  - When I GET `/api/auth/me` with `Authorization: Bearer <token>`
  - Then the user profile is returned
- **Expected:** 200; `{id,email,name}`.

---
**TC-JWT-02 — Access a protected route with no Authorization header**
- **Precondition:** None.
- **Objective:** Missing credentials are rejected.
- **Type:** Negative
- **Steps:**
  - Given no `Authorization` header
  - When I GET `/api/cafes`
  - Then access is denied
- **Expected:** 401, `"Not authenticated"` (HTTPBearer rejects the missing header). *(Confirmed live.)*

---
**TC-JWT-03 — Access with a malformed token**
- **Precondition:** None.
- **Objective:** Garbage tokens are rejected.
- **Type:** Negative
- **Steps:**
  - Given `Authorization: Bearer not.a.jwt`
  - When I GET `/api/cafes`
  - Then decoding fails
- **Expected:** 401, `"Invalid token"`. *(Confirmed live.)*

---
**TC-JWT-04 — Token signed with a different secret**
- **Precondition:** A token forged with a wrong HS256 key.
- **Objective:** Signature verification blocks forged tokens.
- **Type:** Negative
- **Steps:**
  - Given a token signed with `"wrong-secret"`
  - When I GET `/api/auth/me`
  - Then signature verification fails
- **Expected:** 401, `"Invalid token"`.

---
**TC-JWT-05 — Expired token (edge)**
- **Precondition:** A token with `exp` in the past (or `JWT_EXPIRE_DAYS` temporarily set negative).
- **Objective:** Expired tokens are rejected distinctly.
- **Type:** Negative
- **Steps:**
  - Given a token whose `exp` has passed
  - When I GET `/api/cafes`
  - Then the expiry branch triggers
- **Expected:** 401, `"Token expired"`.

---
**TC-JWT-06 — Valid token for a since-deleted user**
- **Precondition:** User A's token, then A's `users` document deleted.
- **Objective:** Tokens for missing users are rejected.
- **Type:** Negative
- **Steps:**
  - Given a still-unexpired token for User A
  - And A's user document has been deleted
  - When I GET `/api/cafes`
  - Then the user lookup fails
- **Expected:** 401, `"User not found"`.

---
**TC-JWT-07 — Token missing the `sub` claim**
- **Precondition:** A validly-signed token with no `sub`.
- **Objective:** Tokens without a subject are rejected.
- **Type:** Negative
- **Steps:**
  - Given a signed token whose payload omits `sub`
  - When I GET `/api/auth/me`
  - Then the missing-subject branch triggers
- **Expected:** 401, `"Invalid token"`.

---
**TC-JWT-08 — Token remains valid after password change (edge / risk)**
- **Precondition:** User A logged in (token T); A's password later changed server-side.
- **Objective:** Document that there is no token revocation.
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given token T was issued before the password change
  - When I use T after the password is changed
  - Then it still works because tokens are stateless with a 30-day life
- **Expected (current):** 200. **Desired:** invalidated. See RISK-06.

### 4.4 Café — Create

---
**TC-CAFE-01 — Create a café with all fields**
- **Precondition:** Authenticated User A.
- **Objective:** A fully-populated café is created and owned by A.
- **Type:** Positive
- **Steps:**
  - Given A is authenticated
  - When I POST `/api/cafes` with name, photos, location_link, address, notes, rating, favorite_drink, visited_date
  - Then the café is created
- **Expected:** 200; response echoes fields; `id` (UUID), `user_id == A.id`, `created_at` set; `_id` absent.

---
**TC-CAFE-02 — Create a café with only a name (minimal)**
- **Precondition:** Authenticated User A.
- **Objective:** Optional fields default correctly.
- **Type:** Positive
- **Steps:**
  - Given A is authenticated
  - When I POST `/api/cafes` with only `{name}`
  - Then defaults apply
- **Expected:** 200; `photos=[]`, strings default `""`, `rating=0`, `visited_date` defaults to today's `YYYY-MM-DD`.

---
**TC-CAFE-03 — Create a café with no name**
- **Precondition:** Authenticated User A.
- **Objective:** Name is required.
- **Type:** Negative
- **Steps:**
  - Given A is authenticated
  - When I POST `/api/cafes` with `name = ""` (or omitted)
  - Then validation fails
- **Expected:** 422.

---
**TC-CAFE-04 — Create with rating below 0**
- **Precondition:** Authenticated User A.
- **Objective:** Rating lower bound enforced.
- **Type:** Negative
- **Steps:**
  - Given A is authenticated
  - When I POST `/api/cafes` with `rating = -1`
  - Then validation fails
- **Expected:** 422 (`ge=0`).

---
**TC-CAFE-05 — Create with rating above 5**
- **Precondition:** Authenticated User A.
- **Objective:** Rating upper bound enforced.
- **Type:** Negative
- **Steps:**
  - Given A is authenticated
  - When I POST `/api/cafes` with `rating = 6`
  - Then validation fails
- **Expected:** 422 (`le=5`).

---
**TC-CAFE-06 — Create with rating at boundaries (0 and 5)**
- **Precondition:** Authenticated User A.
- **Objective:** Boundary ratings accepted.
- **Type:** Positive
- **Steps:**
  - Given A is authenticated
  - When I create one café with `rating=0` and another with `rating=5`
  - Then both succeed
- **Expected:** 200 for both.

---
**TC-CAFE-07 — Create with empty visited_date defaults to today**
- **Precondition:** Authenticated User A.
- **Objective:** Empty date falls back to server "today".
- **Type:** Positive (edge)
- **Steps:**
  - Given A is authenticated
  - When I POST `/api/cafes` with `visited_date = ""`
  - Then the server substitutes today's date
- **Expected:** 200; `visited_date == today (YYYY-MM-DD)`.

---
**TC-CAFE-08 — Create with a non-date string in visited_date (edge / risk)**
- **Precondition:** Authenticated User A.
- **Objective:** Expose that `visited_date` has no format validation.
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given A is authenticated
  - When I POST `/api/cafes` with `visited_date = "banana"`
  - Then the backend stores it verbatim
- **Expected (current):** 200, stored as `"banana"`; later silently excluded from stats month grouping. **Desired:** 422 / format validation. See RISK-01.

---
**TC-CAFE-09 — Create with many large photos (edge)**
- **Precondition:** Authenticated User A.
- **Objective:** Behaviour near MongoDB's 16 MB document ceiling.
- **Type:** Negative (boundary/limits)
- **Steps:**
  - Given A is authenticated
  - When I POST `/api/cafes` with enough base64 photos to approach 16 MB
  - Then the write is attempted
- **Expected:** Documented limit — succeeds under 16 MB, fails (server error) at/over the ceiling. See RISK-08.

---
**TC-CAFE-10 — Create without authentication**
- **Precondition:** None.
- **Objective:** Café creation requires a token.
- **Type:** Negative
- **Steps:**
  - Given no `Authorization` header
  - When I POST `/api/cafes`
  - Then access is denied
- **Expected:** 401, `"Not authenticated"`.

### 4.5 Café — Read (list & detail)

---
**TC-READ-01 — List returns only the caller's cafés, newest first**
- **Precondition:** User A has ≥2 cafés created at different times.
- **Objective:** List is scoped and sorted by `created_at` desc.
- **Type:** Positive
- **Steps:**
  - Given A owns multiple cafés
  - When I GET `/api/cafes` as A
  - Then only A's cafés are returned, newest first
- **Expected:** 200; array sorted by `created_at` descending.

---
**TC-READ-02 — List payload includes only the cover photo**
- **Precondition:** User A has a café with ≥2 photos.
- **Objective:** Verify the `$slice: 1` projection on the list endpoint.
- **Type:** Positive
- **Steps:**
  - Given a café created with 3 photos
  - When I GET `/api/cafes`
  - Then each café carries only its first photo
- **Expected:** 200; `photos.length == 1` in the list even though 3 were stored. *(Confirmed live.)*

---
**TC-READ-03 — Detail returns the full photo array**
- **Precondition:** Café with ≥2 photos.
- **Objective:** Detail is not sliced.
- **Type:** Positive
- **Steps:**
  - Given a café with 3 photos
  - When I GET `/api/cafes/{id}`
  - Then all photos are returned
- **Expected:** 200; `photos.length == 3`.

---
**TC-READ-04 — Get a non-existent café**
- **Precondition:** Authenticated User A; random UUID not in DB.
- **Objective:** Unknown id returns 404.
- **Type:** Negative
- **Steps:**
  - Given a UUID that does not exist
  - When I GET `/api/cafes/{uuid}`
  - Then it is not found
- **Expected:** 404, `"Cafe not found"`.

---
**TC-READ-05 — List when the user has no cafés**
- **Precondition:** Freshly registered user with no cafés.
- **Objective:** Empty list, not an error.
- **Type:** Positive
- **Steps:**
  - Given a new user
  - When I GET `/api/cafes`
  - Then an empty array is returned
- **Expected:** 200; `[]`.

### 4.6 Café — Update

---
**TC-UPD-01 — Partial update of a single field**
- **Precondition:** User A owns café X.
- **Objective:** Only provided fields change.
- **Type:** Positive
- **Steps:**
  - Given A owns café X
  - When I PUT `/api/cafes/{X}` with only `{name: "Renamed"}`
  - Then the name changes and other fields are untouched
- **Expected:** 200; `name` updated; other fields preserved.

---
**TC-UPD-02 — Update with an empty body**
- **Precondition:** User A owns café X.
- **Objective:** No-op updates are rejected.
- **Type:** Negative
- **Steps:**
  - Given A owns café X
  - When I PUT `/api/cafes/{X}` with `{}`
  - Then there is nothing to update
- **Expected:** 400, `"No fields to update"`.

---
**TC-UPD-03 — Update with rating out of range**
- **Precondition:** User A owns café X.
- **Objective:** Rating bounds enforced on update too.
- **Type:** Negative
- **Steps:**
  - Given A owns café X
  - When I PUT `/api/cafes/{X}` with `rating = 9`
  - Then validation fails
- **Expected:** 422.

---
**TC-UPD-04 — Update a non-existent café**
- **Precondition:** Authenticated User A.
- **Objective:** Unknown id returns 404.
- **Type:** Negative
- **Steps:**
  - Given a UUID not in DB
  - When I PUT `/api/cafes/{uuid}` with a valid field
  - Then it is not found
- **Expected:** 404, `"Cafe not found"`.

---
**TC-UPD-05 — Update visited_date to empty string blanks it (edge)**
- **Precondition:** User A owns café X with a real date.
- **Objective:** Expose that `""` passes the `is not None` filter and overwrites.
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given café X has `visited_date = "2026-07-01"`
  - When I PUT `/api/cafes/{X}` with `visited_date = ""`
  - Then the stored date is blanked (empty string is not None)
- **Expected (current):** 200; `visited_date == ""`. Low real-world risk (the form always sends a value). See RISK-07.

### 4.7 Café — Delete

---
**TC-DEL-01 — Delete an owned café**
- **Precondition:** User A owns café X.
- **Objective:** Owner can delete.
- **Type:** Positive
- **Steps:**
  - Given A owns café X
  - When I DELETE `/api/cafes/{X}`
  - Then it is removed
- **Expected:** 200, `{ok: true}`; subsequent GET → 404.

---
**TC-DEL-02 — Delete an already-deleted café**
- **Precondition:** Café X already deleted.
- **Objective:** Second delete is a clean 404.
- **Type:** Negative
- **Steps:**
  - Given café X was already deleted
  - When I DELETE `/api/cafes/{X}` again
  - Then nothing matches
- **Expected:** 404, `"Cafe not found"`.

---
**TC-DEL-03 — Delete without authentication**
- **Precondition:** None.
- **Objective:** Delete requires a token.
- **Type:** Negative
- **Steps:**
  - Given no `Authorization` header
  - When I DELETE `/api/cafes/{any}`
  - Then access is denied
- **Expected:** 401, `"Not authenticated"`.

### 4.8 Stats

---
**TC-STAT-01 — Stats with data**
- **Precondition:** User A has several rated cafés with drinks and dates.
- **Objective:** Aggregates are correct.
- **Type:** Positive
- **Steps:**
  - Given A owns rated cafés
  - When I GET `/api/stats`
  - Then aggregates are computed over A's cafés only
- **Expected:** 200; `total_cafes` = count; `average_rating` = mean rounded to 2; `top_drink` = most frequent non-empty drink; `five_star_count` = count of rating==5; `by_month` present.

---
**TC-STAT-02 — Stats with no cafés (edge)**
- **Precondition:** New user, no cafés.
- **Objective:** No division-by-zero; sensible zeros.
- **Type:** Positive
- **Steps:**
  - Given a user with zero cafés
  - When I GET `/api/stats`
  - Then all aggregates return safe defaults
- **Expected:** 200; `total_cafes=0`, `average_rating=0`, `top_drink=""`, `five_star_count=0`, `by_month=[]`.

---
**TC-STAT-03 — Top drink ignores empty/blank drinks**
- **Precondition:** Cafés where some have blank `favorite_drink`.
- **Objective:** Blank drinks are excluded from the tally.
- **Type:** Positive
- **Steps:**
  - Given 3 cafés with `"Latte"` and 5 with `""`
  - When I GET `/api/stats`
  - Then only non-empty drinks are counted
- **Expected:** `top_drink == "Latte"`.

---
**TC-STAT-04 — By-month excludes malformed dates (edge)**
- **Precondition:** Cafés where one has `visited_date = "2026"` (too short) or `"banana"`.
- **Objective:** Only `len >= 7` dates are grouped.
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given a café with a short/garbage `visited_date`
  - When I GET `/api/stats`
  - Then that café is silently omitted from `by_month`
- **Expected:** That café is absent from `by_month` and its count is lost from the chart (but still counted in `total_cafes`). See RISK-01.

---
**TC-STAT-05 — "Last 6 months" shows last 6 months WITH data (edge / risk)**
- **Precondition:** Cafés spanning 8 distinct months, including a gap.
- **Objective:** Expose that the label is misleading.
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given cafés in Jan, Feb, Mar 2025 and then May, Jun 2026 (a long gap)
  - When I GET `/api/stats`
  - Then `by_month` returns the last 6 populated months, not the last 6 calendar months
- **Expected (current):** old months can appear under a "Last 6 months" heading. See RISK-02.

---
**TC-STAT-06 — Top-drink tie is deterministic within a request**
- **Precondition:** Two drinks tied on count.
- **Objective:** Document tie-break behaviour.
- **Type:** Positive (informational)
- **Steps:**
  - Given `"Latte"` and `"Mocha"` each appear twice
  - When I GET `/api/stats`
  - Then `max()` returns the first-inserted key at that count
- **Expected:** Stable for a fixed insertion order; note it is not a defined product rule.

### 4.9 Multi-user isolation

---
**TC-ISO-01 — User A cannot see User B's cafés in the list**
- **Precondition:** A and B each own cafés.
- **Objective:** List is strictly per-user.
- **Type:** Negative
- **Steps:**
  - Given B owns café Y
  - When I GET `/api/cafes` as A
  - Then Y is not present
- **Expected:** A's list contains only A's cafés.

---
**TC-ISO-02 — User A cannot GET User B's café by id**
- **Precondition:** B owns café Y (A knows the id).
- **Objective:** Cross-user detail is blocked without leaking existence.
- **Type:** Negative
- **Steps:**
  - Given A has B's café id Y
  - When I GET `/api/cafes/{Y}` as A
  - Then it is reported as not found
- **Expected:** 404 (same as a non-existent id).

---
**TC-ISO-03 — User A cannot UPDATE User B's café**
- **Precondition:** B owns café Y.
- **Objective:** Cross-user writes blocked.
- **Type:** Negative
- **Steps:**
  - Given A has B's café id Y
  - When I PUT `/api/cafes/{Y}` as A
  - Then no document matches A's filter
- **Expected:** 404; Y unchanged.

---
**TC-ISO-04 — User A cannot DELETE User B's café**
- **Precondition:** B owns café Y.
- **Objective:** Cross-user delete blocked.
- **Type:** Negative
- **Steps:**
  - Given A has B's café id Y
  - When I DELETE `/api/cafes/{Y}` as A
  - Then nothing is deleted
- **Expected:** 404; Y still exists for B.

---
**TC-ISO-05 — Stats are scoped per user**
- **Precondition:** A and B both have cafés.
- **Objective:** Stats never mix users.
- **Type:** Positive
- **Steps:**
  - Given A and B each own cafés
  - When each requests `/api/stats`
  - Then each total reflects only their own cafés
- **Expected:** A's `total_cafes` counts only A's; B's only B's.

### 4.10 Frontend UI flows

---
**TC-UI-01 — App boot with a valid stored token lands on Journal**
- **Precondition:** A valid token in secure storage.
- **Objective:** Returning users skip login.
- **Type:** Positive
- **Steps:**
  - Given a valid token is stored
  - When the app boots and calls `/auth/me`
  - Then the user is routed to the tabs
- **Expected:** Journal tab shown; no login screen.

---
**TC-UI-02 — App boot with an invalid/expired token routes to Login**
- **Precondition:** An expired/garbage token in storage.
- **Objective:** Bad tokens are cleared on boot.
- **Type:** Positive
- **Steps:**
  - Given a stale token is stored
  - When boot calls `/auth/me` and it fails
  - Then the token is cleared and login is shown
- **Expected:** Login screen; storage no longer holds the token.

---
**TC-UI-03 — Login with empty fields shows an inline error**
- **Precondition:** On the login screen.
- **Objective:** Client-side guard before calling the API.
- **Type:** Negative
- **Steps:**
  - Given empty email and/or password
  - When I tap Sign in
  - Then an inline error appears and no request is sent
- **Expected:** `"Please enter email and password."` in `login-error`.

---
**TC-UI-04 — Navigate from Login to Register**
- **Precondition:** On the login screen.
- **Objective:** Register link works.
- **Type:** Positive
- **Steps:**
  - Given I am on Login
  - When I tap the Register link
  - Then the register screen opens
- **Expected:** Register form displayed.

---
**TC-UI-05 — Journal search filters by name, drink, and address**
- **Precondition:** Logged in with several cafés.
- **Objective:** Client-side filtering works across fields.
- **Type:** Positive
- **Steps:**
  - Given cafés with varied names/drinks/addresses
  - When I type a query in the search box
  - Then only matching cafés remain (case-insensitive)
- **Expected:** Filtered list updates live.

---
**TC-UI-06 — Journal empty state**
- **Precondition:** Logged in with zero cafés.
- **Objective:** Friendly empty state shown.
- **Type:** Positive
- **Steps:**
  - Given the user has no cafés
  - When the Journal loads
  - Then the empty state is displayed
- **Expected:** `empty-state` visible with "No cafés logged yet".

---
**TC-UI-07 — Pull-to-refresh reloads the journal**
- **Precondition:** Logged in.
- **Objective:** Refresh control refetches.
- **Type:** Positive
- **Steps:**
  - Given the Journal is showing
  - When I pull to refresh
  - Then the list refetches from the API
- **Expected:** Spinner then updated list.

---
**TC-UI-08 — Café with no photo shows a placeholder**
- **Precondition:** A café with `photos=[]`.
- **Objective:** Missing image handled gracefully.
- **Type:** Positive
- **Steps:**
  - Given a café without photos
  - When it renders in the list/detail
  - Then a café-icon placeholder shows instead of a broken image
- **Expected:** Placeholder rendered.

---
**TC-UI-09 — Photo permission denied while adding a café**
- **Precondition:** On the café form; OS will deny media-library permission.
- **Objective:** Denied permission is handled, not crashed.
- **Type:** Negative
- **Steps:**
  - Given media-library permission is denied
  - When I tap Add photo
  - Then an inline error is shown and no picker opens
- **Expected:** `"Photo access permission denied."`.

---
**TC-UI-10 — Submit café form with empty name**
- **Precondition:** On the café form with a blank name.
- **Objective:** Client validation before save.
- **Type:** Negative
- **Steps:**
  - Given the name field is empty
  - When I tap Save
  - Then an inline error appears and no request fires
- **Expected:** `"Please give your café a name."`.

---
**TC-UI-11 — Whitespace-only café name is trimmed then rejected (edge)**
- **Precondition:** On the café form; name = "   ".
- **Objective:** Frontend trims before validating.
- **Type:** Negative
- **Steps:**
  - Given the name is only spaces
  - When I tap Save
  - Then `name.trim()` is empty and the client blocks it
- **Expected:** Same error as TC-UI-10 (unlike the raw API — see TC-AUTH-09/RISK-04).

---
**TC-UI-12 — Delete café: cancel keeps the café**
- **Precondition:** On a café detail screen.
- **Objective:** Confirmation dialog can be dismissed safely.
- **Type:** Positive
- **Steps:**
  - Given I tap the delete (trash) button
  - When the confirm dialog appears and I choose Cancel
  - Then nothing is deleted and I stay on the detail screen
- **Expected:** No DELETE request; café intact. *(Covers the new confirm dialog; native alert + web `window.confirm`.)*

---
**TC-UI-13 — Delete café: confirm removes it**
- **Precondition:** On a café detail screen.
- **Objective:** Confirmed delete removes the café and navigates back.
- **Type:** Positive
- **Steps:**
  - Given I tap delete and choose Delete/OK in the dialog
  - When the DELETE call succeeds
  - Then I am returned to the journal and the café is gone
- **Expected:** DELETE 200; café absent from the list on return.

---
**TC-UI-14 — Expired session mid-use redirects to Login**
- **Precondition:** Logged in; token invalidated/expired server-side while browsing.
- **Objective:** A 401 on any non-auth call clears the token and routes to login.
- **Type:** Positive
- **Steps:**
  - Given the stored token is no longer valid
  - When any screen makes an API call and receives 401
  - Then the client clears the token and navigates to Login
- **Expected:** Redirect to `/(auth)/login`; token cleared. *(Covers the new 401 handler; excludes `/auth/*` so wrong-password stays inline.)*

---
**TC-UI-15 — Places lists only cafés with a location link or address**
- **Precondition:** Some cafés with location/address, some without.
- **Objective:** Places filters correctly.
- **Type:** Positive
- **Steps:**
  - Given a mix of cafés
  - When I open the Places tab
  - Then only cafés with `location_link` or `address` appear
- **Expected:** Filtered list; others hidden.

---
**TC-UI-16 — Open in Google Maps launches the saved link**
- **Precondition:** A café with a valid `location_link`.
- **Objective:** External link opens.
- **Type:** Positive
- **Steps:**
  - Given a café with a Maps share link
  - When I tap "Open in Google Maps"
  - Then `Linking.openURL` is invoked with that link
- **Expected:** Maps app / URL opens.

---
**TC-UI-17 — Network error while loading a list is handled**
- **Precondition:** Backend unreachable.
- **Objective:** No crash on fetch failure.
- **Type:** Negative
- **Steps:**
  - Given the backend is down
  - When the Journal tries to load
  - Then the error is caught and the loading state ends
- **Expected:** No crash; empty/last-known list; error logged. (Consider adding a visible error state — see RISK-09.)

---
**TC-UI-18 — Creating a café navigates to its detail**
- **Precondition:** On the New Café form, valid data.
- **Objective:** Post-create navigation.
- **Type:** Positive
- **Steps:**
  - Given a valid new café
  - When I Save
  - Then I am redirected to the new café's detail
- **Expected:** Detail screen for the created id.

---
**TC-UI-19 — Editing a café pre-fills the form**
- **Precondition:** On a café detail, tap edit.
- **Objective:** Edit form seeds from existing values.
- **Type:** Positive
- **Steps:**
  - Given an existing café
  - When I open Edit
  - Then all fields are pre-populated
- **Expected:** Form shows current name/photos/rating/etc.

### 4.11 Security & non-functional

---
**TC-SEC-01 — CORS allows any origin with credentials**
- **Precondition:** Backend running.
- **Objective:** Document the permissive CORS posture.
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given `allow_origins=["*"]` with `allow_credentials=True`
  - When a cross-origin request is made
  - Then the response permits it
- **Expected:** Works today; tighten origins before production. See RISK-03.

---
**TC-SEC-02 — Login has no rate limiting (brute force)**
- **Precondition:** A known email.
- **Objective:** Expose unthrottled password attempts.
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given a target email
  - When many wrong-password logins are sent rapidly
  - Then all are processed without lockout/backoff
- **Expected:** No throttling. See RISK-05.

---
**TC-SEC-03 — `location_link` opened without scheme validation**
- **Precondition:** A café whose `location_link` is a non-https scheme.
- **Objective:** Expose that any stored string is passed to `Linking.openURL`.
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given a café with `location_link = "javascript:alert(1)"` or an arbitrary app scheme
  - When I tap "Open in Google Maps"
  - Then the raw string is handed to `openURL`
- **Expected:** Should be validated to `http(s)`/maps schemes. Self-entered data lowers risk but it is unguarded. See RISK-10.

---
**TC-SEC-04 — Weak default `JWT_SECRET`**
- **Precondition:** `.env` still using a placeholder secret.
- **Objective:** Ensure production rotates the secret.
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given `JWT_SECRET` is a short/placeholder value
  - When tokens are signed
  - Then they are forgeable if the secret is guessable
- **Expected:** Enforce a strong secret; PyJWT already warns on short keys. See RISK-11.

---
**TC-SEC-05 — No server-side pagination (data-loss ceiling)**
- **Precondition:** A user with >1000 cafés (or >10000 for stats).
- **Objective:** Expose the hard list caps.
- **Type:** Negative (expected-to-expose-gap)
- **Steps:**
  - Given a user exceeds the `to_list(1000)` / `to_list(10000)` caps
  - When they load the journal or stats
  - Then results are silently truncated
- **Expected:** Add pagination before scale. See RISK-12.

---

## 5. Edge cases & risk register

Highest-value issues surfaced by this plan. Each links to the test cases that exercise it.

| ID | Severity | Issue | Where | Exercised by |
|---|---|---|---|---|
| RISK-01 | **High** | `visited_date` has **no format validation** — any string is stored. Garbage/short dates are silently dropped from the stats month chart while still counting in `total_cafes`, so the chart and total disagree. | `CafeCreate.visited_date`, `stats.by_month` | TC-CAFE-08, TC-STAT-04 |
| RISK-02 | **Medium** | Stats chart is labelled **"Last 6 months"** but returns the last 6 months *that contain data* (`sorted(...)[-6:]`). After an inactive stretch it shows stale months as if recent. | `stats` / `stats.tsx` | TC-STAT-05 |
| RISK-03 | **Medium** | CORS `allow_origins=["*"]` **with** `allow_credentials=True`. Low practical risk today (Bearer, not cookies) but should be tightened. | `server.py` middleware | TC-SEC-01 |
| RISK-04 | **Low** | Backend accepts a **whitespace-only `name`** (register and café) because `min_length=1` counts a space; only the frontend trims. | Pydantic models | TC-AUTH-09, TC-UI-11 |
| RISK-05 | **Medium** | **No login rate limiting** — unlimited password guesses. | `login` | TC-SEC-02 |
| RISK-06 | **Medium** | **No token revocation**. Logout is client-only; a leaked token stays valid up to 30 days, even after a password change. | `create_token`, `get_current_user` | TC-JWT-08 |
| RISK-07 | **Low** | Update treats `""` as a real value (`is not None`), so sending `visited_date=""` **blanks** the date. Form always sends a value, so low real-world impact. | `update_cafe` | TC-UPD-05 |
| RISK-08 | **Medium** | Photos are stored **inline as base64**; a café can approach MongoDB's **16 MB** document limit, and detail responses return every photo. | `cafes` schema | TC-CAFE-09, TC-READ-03 |
| RISK-09 | **Low** | List/detail load failures only `console.warn` — no visible error state, so a failed fetch looks like "empty". | `(tabs)/*`, `cafe/[id].tsx` | TC-UI-17 |
| RISK-10 | **Low/Med** | `location_link` is passed to `Linking.openURL` **without scheme validation**. Self-entered data limits exposure, but non-`http(s)` schemes are opened as-is. | `cafe/[id].tsx`, `places.tsx` | TC-SEC-03 |
| RISK-11 | **High (prod)** | Placeholder/short `JWT_SECRET` makes tokens forgeable. Must be rotated to a strong random value in production. | `.env` / `JWT_SECRET` | TC-SEC-04 |
| RISK-12 | **Medium** | No pagination — `to_list(1000)` (list) and `to_list(10000)` (stats) silently cap results. | `list_cafes`, `stats` | TC-SEC-05 |
| RISK-13 | **Low** | On web, the JWT lives in AsyncStorage/localStorage (no Keychain), exposing it to XSS. Acceptable for scope; note for production. | `storage/index.web.ts` | TC-UI-02 |

## 6. Suggested execution order

1. **API contract** (§4.1–4.8) — fast, deterministic; run first (extend `backend/tests/test_cafe_journal_api.py`).
2. **Isolation** (§4.9) — security-critical; must pass before any release.
3. **Frontend flows** (§4.10) — manual or Detox/Maestro E2E.
4. **Security/non-functional** (§4.11) — mostly one-time posture checks tracked in the risk register.
