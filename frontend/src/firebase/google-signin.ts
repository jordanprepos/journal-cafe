import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useCallback } from "react";

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
 * Google sign-in on iOS/Android. Opens the system browser via expo-auth-session,
 * then trades the returned Google ID token for a Firebase credential.
 *
 * The client IDs come from the OAuth clients Firebase generates when Google
 * sign-in is enabled on a registered app — see frontend/.env.example.
 */
export function useGoogleSignIn(): GoogleSignIn {
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
