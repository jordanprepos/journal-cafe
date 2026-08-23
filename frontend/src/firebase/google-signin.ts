import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useCallback } from "react";
import { Platform } from "react-native";

import { auth } from "./config";

// Lets the auth popup hand control back to the app when it redirects.
WebBrowser.maybeCompleteAuthSession();

export type GoogleSignIn = {
  /** Resolves true on success, false if the user dismissed the sheet. */
  signIn: () => Promise<boolean>;
  /** False until the OAuth request has been prepared — keep the button disabled. */
  ready: boolean;
};

/**
 * The OAuth client for the platform this bundle was built for, or undefined
 * when that value was never set. Only the current platform's ID matters:
 * expo-auth-session picks one with `Platform.select` and ignores the rest.
 */
const platformClientId = Platform.select({
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

/**
 * Google sign-in on iOS/Android. Opens the system browser via expo-auth-session,
 * then trades the returned Google ID token for a Firebase credential.
 *
 * The client IDs come from the OAuth clients Firebase generates when Google
 * sign-in is enabled on a registered app — see frontend/.env.example.
 */
function useConfiguredGoogleSignIn(): GoogleSignIn {
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  const signIn = useCallback(async () => {
    const result = await promptAsync();
    if (result.type === "error") {
      throw new Error(result.error?.message ?? "Google sign-in failed.");
    }
    // "cancel" / "dismiss" — the user backed out, which isn't an error.
    if (result.type !== "success") return false;

    const idToken = result.params?.id_token;
    if (!idToken) throw new Error("Google did not return an ID token.");

    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return true;
  }, [promptAsync]);

  return { signIn, ready: !!request };
}

/** Stand-in for builds with no OAuth client — reports not-ready, never throws. */
function useUnavailableGoogleSignIn(): GoogleSignIn {
  const signIn = useCallback(async () => {
    throw new Error("Google sign-in isn't configured for this build.");
  }, []);

  return { signIn, ready: false };
}

/**
 * `useIdTokenAuthRequest` throws outright when the current platform's client ID
 * is undefined, and AuthProvider calls this hook — so on a build missing that
 * value the throw lands during the first render of the tree that wraps the whole
 * app, killing it before any screen appears. Email/password sign-in would work
 * fine; it never gets the chance. An unconfigured optional provider should cost
 * you that provider, not the app.
 *
 * Choosing between the two implementations here rather than inside the hook is
 * what keeps this legal: EXPO_PUBLIC_* values are baked into the bundle at build
 * time, so this branch resolves once at module load and the hook order every
 * component sees stays fixed for the process lifetime.
 */
export const useGoogleSignIn: () => GoogleSignIn = platformClientId
  ? useConfiguredGoogleSignIn
  : useUnavailableGoogleSignIn;
