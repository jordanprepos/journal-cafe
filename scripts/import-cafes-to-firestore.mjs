#!/usr/bin/env node
/**
 * Step 2 of the Mongo -> Firestore migration: import the JSON dump.
 *
 * Signs in as you with the ordinary client SDK — no service-account key needed —
 * then writes each café to users/{uid}/cafes and moves its base64 photos into
 * Cloud Storage, exactly as the app does. Everything goes through the real
 * security rules, so a successful run also proves the rules accept the app's writes.
 *
 * Run from the repo root, after `frontend/.env` is filled in:
 *
 *   node scripts/import-cafes-to-firestore.mjs cafes-export.json you@example.com 'your-password'
 *
 * The Firebase account must already exist — register in the app first, or sign
 * in with Google and use that account's email with a password you've set.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = join(here, "..", "frontend");

// Resolve `firebase` out of frontend/node_modules rather than requiring a
// second install at the repo root.
const require = createRequire(join(frontend, "package.json"));
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const {
  addDoc,
  collection,
  getFirestore,
  Timestamp,
  updateDoc,
} = require("firebase/firestore");
const {
  getDownloadURL,
  getStorage,
  ref,
  uploadString,
} = require("firebase/storage");

function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(frontend, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const [, , jsonPath, email, password] = process.argv;
if (!jsonPath || !email || !password) {
  console.error(
    "usage: node scripts/import-cafes-to-firestore.mjs <export.json> <email> <password>",
  );
  process.exit(2);
}

const env = loadEnv();
const app = initializeApp({
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
});

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const { cafes } = JSON.parse(readFileSync(jsonPath, "utf8"));
const { user } = await signInWithEmailAndPassword(auth, email, password);
console.log(`Signed in as ${user.email} (${user.uid})`);

const cafesCol = collection(db, "users", user.uid, "cafes");
let imported = 0;
let photosUploaded = 0;

for (const cafe of cafes) {
  // `id` and `user_id` are Mongo's; Firestore's doc id and path replace them.
  //
  // Cafés logged before a feature shipped are missing that field entirely in
  // Mongo — of 167 real entries, 61 have no `tags` key at all. firestore.rules
  // requires it (`hasAll`), so every one of those would be permission-denied
  // without a default here. The rest are optional in the rules but defaulted
  // anyway so the imported documents match what the app writes today.
  const { id: _mongoId, photos = [], created_at, ...rest } = cafe;

  const created = await addDoc(cafesCol, {
    location_link: "",
    address: "",
    notes: "",
    rating: 0,
    favorite_drink: "",
    visited_date: "",
    tags: [],
    recommended_menu: [],
    facilities: [],
    hospitality: 0,
    ...rest,
    photos: [],
    created_at: created_at
      ? Timestamp.fromDate(new Date(created_at))
      : Timestamp.now(),
  });

  const urls = [];
  for (const [idx, photo] of photos.entries()) {
    if (typeof photo !== "string" || !photo.startsWith("data:")) continue;
    const objectRef = ref(
      storage,
      `users/${user.uid}/cafes/${created.id}/migrated-${idx}.jpg`,
    );
    await uploadString(objectRef, photo, "data_url");
    urls.push(await getDownloadURL(objectRef));
    photosUploaded += 1;
  }
  if (urls.length) await updateDoc(created, { photos: urls });

  imported += 1;
  console.log(`  ${imported}/${cafes.length}  ${cafe.name} (${urls.length} photo(s))`);
}

console.log(`\nDone — ${imported} café(s), ${photosUploaded} photo(s) uploaded.`);
process.exit(0);
