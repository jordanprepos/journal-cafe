import {
  GoogleSignin,
  statusCodes,
  type NativeModuleError,
} from "@react-native-google-signin/google-signin";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useCallback } from "react";
import { Platform } from "react-native";

import { auth } from "./config";

export type GoogleSignIn = {
  /** Resolves true on success, false if the user dismissed the sheet. */
  signIn: () => Promise<boolean>;
  /** False when this build can't do Google sign-in — keep the button disabled. */
  ready: boolean;
};

/**
 * The **web** client ID, not the Android one. Google identifies an Android
 * caller by package name plus the signing certificate's SHA-1 — registered
 * against the Firebase Android app, never sent from here — and the web client is
 * the audience of the ID token handed to Firebase. So the Android OAuth client
 * has to exist, but its ID is not configuration.
 */
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/**
 * Expo Go bundles a fixed set of native modules and this is not one of them, so
 * there is nothing to call there. `yarn start` stays useful for everything else.
 */
const inExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * A build can only sign in with Google if the native module is present and the
 * ID token has an audience. iOS additionally needs its own client ID, which the
 * SDK uses for the URL scheme the config plugin registers.
 *
 * Read once at module load: `EXPO_PUBLIC_*` is baked into the bundle at build
 * time, so none of this can change while the app is running.
 */
const configured =
  !inExpoGo && !!webClientId && (Platform.OS !== "ios" || !!iosClientId);

// `configure` validates nothing and never throws, so an unconfigured build costs
// you the button rather than the app. AuthProvider calls the hook below during
// its first render, and a throw there took the whole tree down at launch before
// this module guarded against it.
if (configured) GoogleSignin.configure({ webClientId, iosClientId });

/**
 * Google sign-in on iOS/Android, through Google's native SDK.
 *
 * It replaced `expo-auth-session` because Google disabled custom-URI-scheme
 * redirects for Android OAuth clients: the browser flow reached Google, was
 * recognised, then failed with "Custom URI scheme is not enabled for your
 * Android client" — with no console setting to turn it back on. The native SDK
 * returns an ID token directly, so no redirect is involved.
 *
 * Web is a separate implementation — see `google-signin.web.ts`.
 */
export function useGoogleSignIn(): GoogleSignIn {
  const signIn = useCallback(async () => {
    if (!configured) {
      throw new Error(
        inExpoGo
          ? "Google sign-in needs a development build — use email and password in Expo Go."
          : "Google sign-in isn't configured for this build.",
      );
    }

    try {
      await GoogleSignin.hasPlayServices();
      const result = await GoogleSignin.signIn();

      // The user backed out of the account chooser. Not an error — and note it
      // arrives as a return value, not a rejection.
      if (result.type !== "success") return false;

      const { idToken } = result.data;
      if (!idToken) throw new Error("Google did not return an ID token.");

      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      return true;
    } catch (e) {
      const { code } = e as NativeModuleError;

      // A second tap while the first sheet is still open.
      if (code === statusCodes.IN_PROGRESS) return false;
      // Some paths still reject on dismissal rather than returning "cancelled".
      if (code === statusCodes.SIGN_IN_CANCELLED) return false;
      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error(
          "Google Play services is unavailable or out of date on this device.",
        );
      }
      throw e;
    }
  }, []);

  return { signIn, ready: configured };
}
