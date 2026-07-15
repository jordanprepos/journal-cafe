"""
Backend API test suite for Cafe Journal app.
Covers: Auth (register/login/me), Cafe CRUD, Stats, Multi-user isolation,
Rating validation, and Authorization checks.
"""
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load EXPO_PUBLIC_BACKEND_URL from frontend/.env (public ingress)
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
).rstrip("/")
API = f"{BASE_URL}/api"

TIMEOUT = 30


# ====== Fixtures ======
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _rand_email(prefix="TEST"):
    return f"{prefix}_{uuid.uuid4().hex[:10]}@example.com"


def _register(session, email, password="Passw0rd!", name="TEST User"):
    """Register a user, failing loudly on a non-200 (e.g. a 429 from the rate
    limiter) instead of KeyError-ing on the missing access_token later."""
    r = session.post(
        f"{API}/auth/register",
        json={"email": email, "password": password, "name": name},
        timeout=TIMEOUT,
    )
    if r.status_code == 429:
        pytest.fail(
            "register was rate-limited (429). The whole suite exceeds the "
            "5/minute cap — start the backend with RATE_LIMIT_ENABLED=false "
            "(see RUNNING.md)."
        )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def user_a(session):
    """Primary user; returns dict with email, password, token, user_id, headers."""
    email = _rand_email("TEST_A")
    password = "Passw0rd!"
    name = "TEST User A"
    data = _register(session, email, password, name)
    return {
        "email": email,
        "password": password,
        "name": name,
        "token": data["access_token"],
        "user_id": data["user"]["id"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
    }


@pytest.fixture(scope="session")
def user_b(session):
    email = _rand_email("TEST_B")
    password = "Passw0rd!"
    data = _register(session, email, password, "TEST User B")
    return {
        "email": email,
        "password": password,
        "token": data["access_token"],
        "user_id": data["user"]["id"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
    }


# ====== Health ======
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/", timeout=TIMEOUT)
        assert r.status_code == 200
        assert "message" in r.json()


# ====== Auth ======
class TestAuth:
    def test_register_returns_token_and_user(self, session):
        email = _rand_email("TEST_REG")
        r = session.post(
            f"{API}/auth/register",
            json={"email": email, "password": "Secret123", "name": "Reg User"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["token_type"] == "bearer"
        assert body["access_token"]
        assert body["user"]["email"] == email.lower()
        assert body["user"]["name"] == "Reg User"
        assert body["user"]["id"]

    def test_register_duplicate_email_returns_400(self, session, user_a):
        r = session.post(
            f"{API}/auth/register",
            json={"email": user_a["email"], "password": "Another1!", "name": "Dup"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 400, r.text

    def test_register_short_password_returns_422(self, session):
        r = session.post(
            f"{API}/auth/register",
            json={"email": _rand_email(), "password": "abc", "name": "X"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 422

    def test_login_valid_creds(self, session, user_a):
        r = session.post(
            f"{API}/auth/login",
            json={"email": user_a["email"], "password": user_a["password"]},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["access_token"]
        assert body["user"]["id"] == user_a["user_id"]

    def test_login_invalid_password(self, session, user_a):
        r = session.post(
            f"{API}/auth/login",
            json={"email": user_a["email"], "password": "WRONGPASS"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 401

    def test_login_unknown_email(self, session):
        r = session.post(
            f"{API}/auth/login",
            json={"email": _rand_email("NOPE"), "password": "whatever"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 401

    def test_me_with_valid_token(self, session, user_a):
        r = session.get(f"{API}/auth/me", headers=user_a["headers"], timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == user_a["user_id"]
        assert body["email"] == user_a["email"].lower()

    def test_me_without_token(self, session):
        r = session.get(f"{API}/auth/me", timeout=TIMEOUT)
        # HTTPBearer returns 403 when missing
        assert r.status_code in (401, 403)

    def test_me_with_invalid_token(self, session):
        r = session.get(
            f"{API}/auth/me",
            headers={"Authorization": "Bearer not.a.real.token"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 401


# ====== Cafes CRUD ======
class TestCafes:
    def test_new_user_has_empty_cafe_list(self, session, user_b):
        r = session.get(f"{API}/cafes", headers=user_b["headers"], timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json() == []

    def test_list_cafes_without_auth(self, session):
        r = session.get(f"{API}/cafes", timeout=TIMEOUT)
        assert r.status_code in (401, 403)

    def test_create_cafe_full_payload_and_get(self, session, user_a):
        payload = {
            "name": "TEST Blue Bottle",
            "photos": [
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=",
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4//8/AAX+Av7czFnnAAAAAElFTkSuQmCC",
            ],
            "location_link": "https://maps.app.goo.gl/abc123",
            "address": "123 Test St",
            "notes": "Lovely vibes",
            "rating": 5,
            "favorite_drink": "Latte",
            "visited_date": "2026-01-10",
            "tags": ["Cozy", "Free Wifi"],
        }
        r = session.post(
            f"{API}/cafes", json=payload, headers=user_a["headers"], timeout=TIMEOUT
        )
        assert r.status_code == 200, r.text
        cafe = r.json()
        assert cafe["id"]
        assert cafe["user_id"] == user_a["user_id"]
        assert cafe["name"] == payload["name"]
        assert cafe["photos"] == payload["photos"]
        assert cafe["location_link"] == payload["location_link"]
        assert cafe["rating"] == 5
        assert cafe["favorite_drink"] == "Latte"
        assert cafe["visited_date"] == "2026-01-10"
        assert cafe["tags"] == payload["tags"]
        # GET to verify persistence
        g = session.get(
            f"{API}/cafes/{cafe['id']}", headers=user_a["headers"], timeout=TIMEOUT
        )
        assert g.status_code == 200
        assert g.json()["name"] == payload["name"]
        # create_cafe builds its document field-by-field, so a field can validate
        # fine and still never reach Mongo. Re-read to prove it actually persisted.
        assert g.json()["tags"] == payload["tags"]
        pytest.cafe_id_a = cafe["id"]  # type: ignore

    def test_create_cafe_without_tags_defaults_to_empty(self, session, user_a):
        r = session.post(
            f"{API}/cafes",
            json={"name": "TEST No Tags"},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        assert r.json()["tags"] == []

    def test_create_cafe_too_many_tags_rejected(self, session, user_a):
        r = session.post(
            f"{API}/cafes",
            json={"name": "TEST Many Tags", "tags": [f"t{i}" for i in range(21)]},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 422

    def test_update_cafe_tags_replaces_rather_than_merges(self, session, user_a):
        c = session.post(
            f"{API}/cafes",
            json={"name": "TEST Tag Update", "tags": ["Cozy", "Clean"]},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        ).json()
        r = session.put(
            f"{API}/cafes/{c['id']}",
            json={"tags": ["Work-Friendly"]},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        assert r.json()["tags"] == ["Work-Friendly"]
        # Untouched fields survive the partial update.
        assert r.json()["name"] == "TEST Tag Update"

    def test_update_cafe_tags_can_be_cleared(self, session, user_a):
        c = session.post(
            f"{API}/cafes",
            json={"name": "TEST Tag Clear", "tags": ["Cozy"]},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        ).json()
        r = session.put(
            f"{API}/cafes/{c['id']}",
            json={"tags": []},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        assert r.json()["tags"] == []

    def test_create_cafe_with_details_round_trip(self, session, user_a):
        payload = {
            "name": "TEST Details Cafe",
            "price_min": 25000,
            "price_max": 50000,
            "price_currency": "IDR",
            "recommended_menu": ["Es kopi susu", "Almond croissant"],
            "facilities": ["wifi", "outdoor", "power_outlets"],
            "hospitality": 4,
        }
        r = session.post(
            f"{API}/cafes", json=payload, headers=user_a["headers"], timeout=TIMEOUT
        )
        assert r.status_code == 200, r.text
        cafe = r.json()
        assert cafe["price_min"] == 25000
        assert cafe["price_max"] == 50000
        assert cafe["price_currency"] == "IDR"
        assert cafe["recommended_menu"] == payload["recommended_menu"]
        assert cafe["facilities"] == payload["facilities"]
        assert cafe["hospitality"] == 4
        # GET to verify persistence (facilities must come back as plain strings)
        g = session.get(
            f"{API}/cafes/{cafe['id']}", headers=user_a["headers"], timeout=TIMEOUT
        )
        assert g.status_code == 200
        assert g.json()["facilities"] == ["wifi", "outdoor", "power_outlets"]

    def test_create_cafe_details_default_when_omitted(self, session, user_a):
        # Cafés without the new fields get safe defaults (mirrors pre-existing docs).
        r = session.post(
            f"{API}/cafes",
            json={"name": "TEST Minimal Cafe"},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        cafe = r.json()
        assert cafe["facilities"] == []
        assert cafe["recommended_menu"] == []
        assert cafe["hospitality"] == 0
        assert cafe["price_min"] is None
        assert cafe["price_currency"] is None

    def test_create_cafe_unknown_facility(self, session, user_a):
        r = session.post(
            f"{API}/cafes",
            json={"name": "TEST Bad", "facilities": ["helipad"]},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 422

    def test_create_cafe_hospitality_out_of_range(self, session, user_a):
        r = session.post(
            f"{API}/cafes",
            json={"name": "TEST Bad", "hospitality": 6},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 422

    def test_create_cafe_price_max_below_min(self, session, user_a):
        r = session.post(
            f"{API}/cafes",
            json={
                "name": "TEST Bad",
                "price_min": 10,
                "price_max": 2,
                "price_currency": "EUR",
            },
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 422

    def test_create_cafe_price_without_currency(self, session, user_a):
        r = session.post(
            f"{API}/cafes",
            json={"name": "TEST Bad", "price_min": 10},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 422

    def test_create_cafe_bad_currency_format(self, session, user_a):
        r = session.post(
            f"{API}/cafes",
            json={"name": "TEST Bad", "price_min": 10, "price_currency": "eur"},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 422

    def test_create_cafe_rating_out_of_range_high(self, session, user_a):
        r = session.post(
            f"{API}/cafes",
            json={"name": "TEST Bad", "rating": 6},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 422

    def test_create_cafe_rating_out_of_range_negative(self, session, user_a):
        r = session.post(
            f"{API}/cafes",
            json={"name": "TEST Bad", "rating": -1},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 422

    def test_create_cafe_without_auth(self, session):
        r = session.post(
            f"{API}/cafes", json={"name": "TEST NoAuth"}, timeout=TIMEOUT
        )
        assert r.status_code in (401, 403)

    def test_list_returns_only_own_cafes(self, session, user_a, user_b):
        # User B creates one
        rb = session.post(
            f"{API}/cafes",
            json={"name": "TEST B Cafe", "rating": 3, "favorite_drink": "Mocha",
                  "visited_date": "2026-01-05"},
            headers=user_b["headers"],
            timeout=TIMEOUT,
        )
        assert rb.status_code == 200
        b_id = rb.json()["id"]

        # User A list should NOT contain B's cafe
        ra = session.get(f"{API}/cafes", headers=user_a["headers"], timeout=TIMEOUT)
        assert ra.status_code == 200
        ids = [c["id"] for c in ra.json()]
        assert b_id not in ids
        assert all(c["user_id"] == user_a["user_id"] for c in ra.json())

        # User B list contains only their cafe
        rb_list = session.get(f"{API}/cafes", headers=user_b["headers"], timeout=TIMEOUT)
        assert rb_list.status_code == 200
        b_ids = [c["id"] for c in rb_list.json()]
        assert b_id in b_ids
        assert all(c["user_id"] == user_b["user_id"] for c in rb_list.json())

    def test_get_other_users_cafe_returns_404(self, session, user_a, user_b):
        # User B creates
        rb = session.post(
            f"{API}/cafes",
            json={"name": "TEST B Private"},
            headers=user_b["headers"],
            timeout=TIMEOUT,
        )
        assert rb.status_code == 200
        b_id = rb.json()["id"]
        # User A tries to fetch
        ra = session.get(
            f"{API}/cafes/{b_id}", headers=user_a["headers"], timeout=TIMEOUT
        )
        assert ra.status_code == 404

    def test_get_nonexistent_cafe_returns_404(self, session, user_a):
        r = session.get(
            f"{API}/cafes/{uuid.uuid4()}",
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 404

    def test_update_cafe_partial(self, session, user_a):
        # Create a cafe
        c = session.post(
            f"{API}/cafes",
            json={"name": "TEST Update", "rating": 2, "favorite_drink": "Tea"},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        ).json()
        cid = c["id"]
        # Update rating + photos
        new_photos = ["data:image/png;base64,AAAA"]
        r = session.put(
            f"{API}/cafes/{cid}",
            json={"rating": 4, "photos": new_photos, "notes": "Updated notes"},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["rating"] == 4
        assert updated["photos"] == new_photos
        assert updated["notes"] == "Updated notes"
        assert updated["name"] == "TEST Update"  # unchanged
        # GET verify
        g = session.get(
            f"{API}/cafes/{cid}", headers=user_a["headers"], timeout=TIMEOUT
        ).json()
        assert g["rating"] == 4
        assert g["notes"] == "Updated notes"

    def test_update_cafe_invalid_rating(self, session, user_a):
        c = session.post(
            f"{API}/cafes",
            json={"name": "TEST Update2", "rating": 1},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        ).json()
        r = session.put(
            f"{API}/cafes/{c['id']}",
            json={"rating": 99},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 422

    def test_update_other_users_cafe_returns_404(self, session, user_a, user_b):
        c = session.post(
            f"{API}/cafes",
            json={"name": "TEST B Update Block"},
            headers=user_b["headers"],
            timeout=TIMEOUT,
        ).json()
        r = session.put(
            f"{API}/cafes/{c['id']}",
            json={"name": "hacked"},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 404

    def test_delete_cafe_and_subsequent_get_returns_404(self, session, user_a):
        c = session.post(
            f"{API}/cafes",
            json={"name": "TEST ToDelete"},
            headers=user_a["headers"],
            timeout=TIMEOUT,
        ).json()
        d = session.delete(
            f"{API}/cafes/{c['id']}", headers=user_a["headers"], timeout=TIMEOUT
        )
        assert d.status_code == 200
        assert d.json().get("ok") is True
        g = session.get(
            f"{API}/cafes/{c['id']}", headers=user_a["headers"], timeout=TIMEOUT
        )
        assert g.status_code == 404

    def test_delete_other_users_cafe_returns_404(self, session, user_a, user_b):
        c = session.post(
            f"{API}/cafes",
            json={"name": "TEST B Delete Block"},
            headers=user_b["headers"],
            timeout=TIMEOUT,
        ).json()
        r = session.delete(
            f"{API}/cafes/{c['id']}", headers=user_a["headers"], timeout=TIMEOUT
        )
        assert r.status_code == 404


# ====== Stats ======
class TestStats:
    def test_stats_without_auth(self, session):
        r = session.get(f"{API}/stats", timeout=TIMEOUT)
        assert r.status_code in (401, 403)

    def test_stats_empty_user(self, session):
        # Fresh user
        email = _rand_email("TEST_STATS_EMPTY")
        reg = _register(session, email, name="Stats Empty")
        h = {"Authorization": f"Bearer {reg['access_token']}"}
        r = session.get(f"{API}/stats", headers=h, timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert body["total_cafes"] == 0
        assert body["average_rating"] == 0
        assert body["top_drink"] == ""
        assert body["five_star_count"] == 0
        assert body["by_month"] == []

    def test_stats_with_data(self, session):
        email = _rand_email("TEST_STATS_DATA")
        reg = _register(session, email, name="Stats Data")
        h = {"Authorization": f"Bearer {reg['access_token']}"}
        cafes = [
            {"name": "S1", "rating": 5, "favorite_drink": "Latte",
             "visited_date": "2025-11-10"},
            {"name": "S2", "rating": 5, "favorite_drink": "Latte",
             "visited_date": "2025-12-15"},
            {"name": "S3", "rating": 3, "favorite_drink": "Mocha",
             "visited_date": "2026-01-05"},
            {"name": "S4", "rating": 4, "favorite_drink": "Latte",
             "visited_date": "2026-01-10"},
        ]
        for c in cafes:
            rr = session.post(f"{API}/cafes", json=c, headers=h, timeout=TIMEOUT)
            assert rr.status_code == 200
        r = session.get(f"{API}/stats", headers=h, timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert body["total_cafes"] == 4
        assert body["average_rating"] == round((5 + 5 + 3 + 4) / 4, 2)
        assert body["top_drink"] == "Latte"
        assert body["five_star_count"] == 2
        # by_month: should have 3 months: 2025-11, 2025-12, 2026-01 (last 6)
        months = {m["month"]: m["count"] for m in body["by_month"]}
        assert months.get("2025-11") == 1
        assert months.get("2025-12") == 1
        assert months.get("2026-01") == 2
        # by_month max 6 entries
        assert len(body["by_month"]) <= 6


# ====== Model-level tests (no live server required) ======
class TestCafeModelBackwardCompat:
    """
    The HTTP suite above can never exercise the real backward-compatibility
    path: every document it creates now *has* the newer keys. Cafés written
    before tags / price / menu / facilities / hospitality shipped do not, and
    `Cafe(**doc)` is called on them directly by list/get/update. These tests
    hit the model itself to cover that.
    """

    @staticmethod
    def _legacy_doc(**overrides):
        """A café document as persisted before any of the newer fields existed."""
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": str(uuid.uuid4()),
            "name": "Legacy Cafe",
            "photos": [],
            "location_link": "",
            "address": "",
            "notes": "",
            "rating": 4,
            "favorite_drink": "Latte",
            "visited_date": "2025-06-01",
            "created_at": "2025-06-01T00:00:00+00:00",
        }
        doc.update(overrides)
        return doc

    def test_document_without_tags_deserializes_to_empty_list(self):
        from server import Cafe

        cafe = Cafe(**self._legacy_doc())
        assert cafe.tags == []

    def test_default_tags_are_not_shared_between_instances(self):
        """Pydantic deep-copies mutable defaults; guard against a regression
        to a plain shared `[]` class attribute."""
        from server import Cafe

        a = Cafe(**self._legacy_doc())
        b = Cafe(**self._legacy_doc())
        a.tags.append("Cozy")
        assert b.tags == []

    def test_document_with_tags_round_trips(self):
        from server import Cafe

        cafe = Cafe(**self._legacy_doc(tags=["Cozy", "Clean"]))
        assert cafe.tags == ["Cozy", "Clean"]

    def test_document_without_detail_fields_gets_defaults(self):
        """Price / menu / facilities / hospitality were added after these docs
        were written, so a legacy document has none of the keys at all."""
        from server import Cafe

        cafe = Cafe(**self._legacy_doc())
        assert cafe.price_min is None
        assert cafe.price_max is None
        assert cafe.price_currency is None
        assert cafe.recommended_menu == []
        assert cafe.facilities == []
        assert cafe.hospitality == 0

    def test_default_detail_lists_are_not_shared_between_instances(self):
        from server import Cafe

        a = Cafe(**self._legacy_doc())
        b = Cafe(**self._legacy_doc())
        a.recommended_menu.append("Flat white")
        a.facilities.append("wifi")
        assert b.recommended_menu == []
        assert b.facilities == []
