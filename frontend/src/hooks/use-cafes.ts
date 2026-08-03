import { useEffect, useState } from "react";

import { subscribeCafe, subscribeCafes, type Cafe } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

type CafesState = { cafes: Cafe[]; loading: boolean; error: string };

/**
 * Live list of the signed-in user's cafés, newest first.
 *
 * Firestore pushes every change, so screens using this don't need to refetch on
 * focus — an edit made on another device (or in another tab) lands here on its own.
 */
export function useCafes(): CafesState {
  const uid = useAuth().user?.id;
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) {
      setCafes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeCafes(
      (list) => {
        setCafes(list);
        setError("");
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
  }, [uid]);

  return { cafes, loading, error };
}

type CafeState = { cafe: Cafe | null; loading: boolean; error: string };

/** Live view of one café. `cafe` goes null once it's deleted anywhere. */
export function useCafe(id: string | undefined): CafeState {
  const uid = useAuth().user?.id;
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeCafe(
      id,
      (c) => {
        setCafe(c);
        setError("");
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
  }, [uid, id]);

  return { cafe, loading, error };
}
