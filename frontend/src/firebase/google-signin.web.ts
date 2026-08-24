import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useCallback } from "react";

import { auth } from "./config";
import type { GoogleSignIn } from "./google-signin";

/**
 * Google sign-in on web. Firebase's own popup flow handles the OAuth round trip,
 * so no OAuth client IDs are needed here.
 *
 * The serving domain must be listed under Authentication > Authorized domains
 * (`localhost` for local dev) or the popup closes with `auth/unauthorized-domain`.
 */
export function useGoogleSignIn(): GoogleSignIn {
  const signIn = useCallback(async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      return true;
    } catch (e: any) {
      // The user closing the popup isn't a failure worth surfacing.
      if (
        e?.code === "auth/popup-closed-by-user" ||
        e?.code === "auth/cancelled-popup-request"
      ) {
        return false;
      }
      throw e;
    }
  }, []);

  return { signIn, ready: true };
}
