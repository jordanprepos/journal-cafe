import { router } from "expo-router";

import { storage } from "@/src/utils/storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "cafe_journal_token";

export async function getToken(): Promise<string | null> {
  return await storage.secureGet<string>(TOKEN_KEY, "");
}

export async function setToken(token: string): Promise<void> {
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await storage.secureRemove(TOKEN_KEY);
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/api${path}`, { ...opts, headers });
  if (!res.ok) {
    // Expired/invalid session — send the user back to login. Auth endpoints are
    // excluded: a 401 there means wrong credentials, shown inline instead.
    if (res.status === 401 && !path.startsWith("/auth/")) {
      await clearToken();
      router.replace("/(auth)/login");
    }
    let detail = `Error ${res.status}`;
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<{ access_token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/auth/me"),
  listCafes: () => request<Cafe[]>("/cafes"),
  getCafe: (id: string) => request<Cafe>(`/cafes/${id}`),
  createCafe: (data: CafeInput) =>
    request<Cafe>("/cafes", { method: "POST", body: JSON.stringify(data) }),
  updateCafe: (id: string, data: Partial<CafeInput>) =>
    request<Cafe>(`/cafes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCafe: (id: string) =>
    request<{ ok: boolean }>(`/cafes/${id}`, { method: "DELETE" }),
  stats: () =>
    request<{
      total_cafes: number;
      average_rating: number;
      top_drink: string;
      five_star_count: number;
      by_month: { month: string; count: number }[];
    }>("/stats"),
};

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
};
export type Cafe = CafeInput & { id: string; user_id: string; created_at: string };
