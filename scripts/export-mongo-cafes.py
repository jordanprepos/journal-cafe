#!/usr/bin/env python3
"""Step 1 of the Mongo -> Firestore migration: dump one user's cafés to JSON.

Reads the local `cafe_journal` database the retired FastAPI backend used and
writes every café belonging to <email> into a JSON file, ready for
`import-cafes-to-firestore.mjs`.

Run with the old backend venv, which already has pymongo:

    backend/venv/bin/python scripts/export-mongo-cafes.py you@example.com

Requires MongoDB to be running (`docker start journal-mongo`).
"""

import json
import os
import sys

from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "cafe_journal")
OUT_PATH = os.environ.get("OUT_PATH", "cafes-export.json")


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    email = sys.argv[1].strip().lower()

    db = MongoClient(MONGO_URL)[DB_NAME]
    user = db.users.find_one({"email": email}, {"_id": 0, "id": 1, "name": 1})
    if not user:
        print(f"No user with email {email} in {DB_NAME}.users", file=sys.stderr)
        return 1

    cafes = list(db.cafes.find({"user_id": user["id"]}, {"_id": 0}))
    # user_id is dropped on import — ownership becomes the Firestore path.
    for c in cafes:
        c.pop("user_id", None)

    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump({"email": email, "name": user.get("name", ""), "cafes": cafes}, fh)

    photos = sum(len(c.get("photos") or []) for c in cafes)
    print(f"Exported {len(cafes)} café(s) and {photos} photo(s) to {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
