import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type CollectionReference,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import type { Facility } from "@/src/constants/facilities";
import { auth, db, storage as fbStorage } from "@/src/firebase/config";

export type User = { id: string; email: string; name: string };

export type CafeInput = {
  name: string;
  photos: string[];
  location_link: string;
  address: string;
  notes: string;
  rating: number;
  favorite_drink: string;
  visited_date: string;
  tags: string[];
  latitude?: number | null;
  longitude?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  price_currency?: string | null;
  recommended_menu?: string[];
  facilities?: Facility[];
  hospitality?: number;
};

export type Cafe = CafeInput & {
  id: string;
  created_at: string;
  // Always present on read — `fromDoc` defaults them, so cafés written before
  // these fields existed still deserialize.
  recommended_menu: string[];
  facilities: Facility[];
  hospitality: number;
};

export type Stats = {
  total_cafes: number;
  average_rating: number;
  top_drink: string;
  five_star_count: number;
  by_month: { month: string; count: number }[];
};

/** Cafés live under the owner's document, so ownership is the path itself. */
function cafesCol(uid: string): CollectionReference {
  return collection(db, "users", uid, "cafes");
}

/**
 * Firestore rejects `undefined` outright (the old JSON.stringify transport just
 * dropped such keys). CafeForm guards its own payload, but the optional fields
 * are typed `?: number | null`, so nothing stops a future caller passing one.
 */
function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined),
  ) as T;
}

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You need to be signed in to do that.");
  return uid;
}

function fromDoc(id: string, data: any): Cafe {
  const ts = data.created_at;
  return {
    id,
    name: data.name ?? "",
    // A just-written doc reports created_at as null until the server timestamp
    // lands, so fall back to now to keep sorting stable for the local echo.
    created_at:
      ts instanceof Timestamp ? ts.toDate().toISOString() : new Date().toISOString(),
    photos: data.photos ?? [],
    location_link: data.location_link ?? "",
    address: data.address ?? "",
    notes: data.notes ?? "",
    rating: data.rating ?? 0,
    favorite_drink: data.favorite_drink ?? "",
    visited_date: data.visited_date ?? "",
    tags: data.tags ?? [],
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    price_min: data.price_min ?? null,
    price_max: data.price_max ?? null,
    price_currency: data.price_currency ?? null,
    recommended_menu: data.recommended_menu ?? [],
    facilities: data.facilities ?? [],
    hospitality: data.hospitality ?? 0,
  };
}

// ── Photos ────────────────────────────────────────────────────────────────
// The picker hands us a local URI (`file://` on device, `blob:`/`data:` on web).
// The image itself would blow Firestore's 1 MiB document ceiling, so it goes to
// Cloud Storage and the document keeps only the download URL. Photos already
// uploaded — an `https` URL loaded from an existing café — pass through.
//
// `fetch(uri).blob()` rather than `uploadString(..., "data_url")`: the latter
// decodes to a Uint8Array and the SDK wraps it in `new Blob([view])`, which React
// Native's Blob does not support and rejects with "Creating blobs from
// 'ArrayBuffer' and 'ArrayBufferView' are not supported". fetch works on every
// URI shape either platform produces, so both share this path.
//
// `contentType` must be set explicitly: uploadBytes otherwise defaults to
// application/octet-stream and storage.rules requires `image/.*`.

async function uploadPhotos(
  uid: string,
  cafeId: string,
  photos: string[],
): Promise<string[]> {
  const results = await Promise.allSettled(
    photos.map(async (photo, idx) => {
      if (/^https?:/.test(photo)) return photo;
      const blob = await (await fetch(photo)).blob();
      const contentType = blob.type || "image/jpeg";
      const ext = contentType.split("/")[1]?.split("+")[0] ?? "jpg";
      const path = `users/${uid}/cafes/${cafeId}/${Date.now()}-${idx}.${ext}`;
      const objectRef = ref(fbStorage, path);
      await uploadBytes(objectRef, blob, { contentType });
      return await getDownloadURL(objectRef);
    }),
  );

  const failed = results.find((r) => r.status === "rejected");
  if (failed) {
    // Don't leave the uploads that did succeed behind — nothing will reference
    // them once this write is abandoned.
    const uploaded = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((url) => !photos.includes(url));
    await deletePhotos(uploaded);
    throw failed.reason;
  }

  return results.map((r) => (r as PromiseFulfilledResult<string>).value);
}

/** Best-effort cleanup — a failed delete shouldn't fail the user's action. */
async function deletePhotos(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(async (url) => {
      try {
        await deleteObject(ref(fbStorage, url));
      } catch {
        // Already gone, or not a Storage URL. Nothing to do.
      }
    }),
  );
}


// ── Realtime ──────────────────────────────────────────────────────────────

/**
 * Live view of the signed-in user's cafés, newest first. Fires immediately with
 * the cached list, then again on every local or remote change. Returns the
 * unsubscribe function — call it on unmount.
 */
export function subscribeCafes(
  onChange: (cafes: Cafe[]) => void,
  onError?: (e: Error) => void,
): () => void {
  let uid: string;
  try {
    uid = requireUid();
  } catch (e) {
    onError?.(e as Error);
    return () => {};
  }
  return onSnapshot(
    query(cafesCol(uid), orderBy("created_at", "desc")),
    (snap) => onChange(snap.docs.map((d) => fromDoc(d.id, d.data()))),
    (e) => onError?.(e),
  );
}

/** Live view of a single café. Calls back with null if it's deleted. */
export function subscribeCafe(
  id: string,
  onChange: (cafe: Cafe | null) => void,
  onError?: (e: Error) => void,
): () => void {
  let uid: string;
  try {
    uid = requireUid();
  } catch (e) {
    onError?.(e as Error);
    return () => {};
  }
  return onSnapshot(
    doc(cafesCol(uid), id),
    (snap) => onChange(snap.exists() ? fromDoc(snap.id, snap.data()) : null),
    (e) => onError?.(e),
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────

/** Mirrors the aggregation the old /api/stats endpoint did server-side. */
export function computeStats(cafes: Cafe[]): Stats {
  const total = cafes.length;
  const avg = total
    ? Math.round((cafes.reduce((s, c) => s + c.rating, 0) / total) * 100) / 100
    : 0;

  const drinkCounts = new Map<string, number>();
  for (const c of cafes) {
    const drink = (c.favorite_drink ?? "").trim();
    if (drink) drinkCounts.set(drink, (drinkCounts.get(drink) ?? 0) + 1);
  }
  const topDrink =
    [...drinkCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const byMonth = new Map<string, number>();
  for (const c of cafes) {
    const date = c.visited_date ?? "";
    if (date.length >= 7) {
      const month = date.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
    }
  }

  return {
    total_cafes: total,
    average_rating: avg,
    top_drink: topDrink,
    five_star_count: cafes.filter((c) => c.rating === 5).length,
    by_month: [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6) // last 6 months
      .map(([month, count]) => ({ month, count })),
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export const api = {
  listCafes: async (): Promise<Cafe[]> => {
    const uid = requireUid();
    const snap = await getDocs(
      query(cafesCol(uid), orderBy("created_at", "desc")),
    );
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
  },

  getCafe: async (id: string): Promise<Cafe> => {
    const uid = requireUid();
    const snap = await getDoc(doc(cafesCol(uid), id));
    if (!snap.exists()) throw new Error("Café not found.");
    return fromDoc(snap.id, snap.data());
  },

  createCafe: async (data: CafeInput): Promise<Cafe> => {
    const uid = requireUid();
    // Create first so photos can be filed under the café's own id, then patch
    // the URLs in. Keeps Storage paths tidy and cleanup a single folder delete.
    const created = await addDoc(cafesCol(uid), {
      ...stripUndefined(data),
      photos: [],
      created_at: serverTimestamp(),
    });

    let photos: string[];
    try {
      photos = await uploadPhotos(uid, created.id, data.photos ?? []);
    } catch (e) {
      // The document is already committed. Leaving it would show the user a
      // failed save that nonetheless added a café to their journal — and every
      // retry would add another. Best-effort, like deletePhotos: a failed
      // rollback must not mask the error that caused it.
      await deleteDoc(created).catch(() => {});
      throw e;
    }
    if (photos.length) await updateDoc(created, { photos });
    return { ...(data as Cafe), id: created.id, photos, created_at: new Date().toISOString() };
  },

  updateCafe: async (id: string, data: Partial<CafeInput>): Promise<void> => {
    const uid = requireUid();
    const target = doc(cafesCol(uid), id);
    const patch: Record<string, unknown> = stripUndefined(data);

    if (data.photos) {
      const before = (await getDoc(target)).data()?.photos ?? [];
      patch.photos = await uploadPhotos(uid, id, data.photos);
      // Drop objects the user removed in this edit.
      const kept = new Set(patch.photos as string[]);
      await deletePhotos(before.filter((url: string) => !kept.has(url)));
    }

    await updateDoc(target, patch);
  },

  deleteCafe: async (id: string): Promise<void> => {
    const uid = requireUid();
    const target = doc(cafesCol(uid), id);
    // Read the photo URLs first: deleting objects one by one keeps us inside the
    // per-object Storage rule. Listing the folder would need `list` on the prefix,
    // which the rules deliberately don't grant.
    const urls: string[] = (await getDoc(target)).data()?.photos ?? [];
    await deleteDoc(target);
    await deletePhotos(urls);
  },

  stats: async (): Promise<Stats> => computeStats(await api.listCafes()),
};
