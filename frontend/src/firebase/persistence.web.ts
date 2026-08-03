import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
} from "firebase/auth";

/** Web counterpart of the native AsyncStorage persistence — backed by localStorage. */
export const authPersistence = browserLocalPersistence;

/**
 * Required for signInWithPopup. `getAuth()` installs this by default, but
 * `initializeAuth()` — which we need in order to set persistence — does not, and
 * popup sign-in then fails with `auth/argument-error`.
 */
export const authPopupResolver = browserPopupRedirectResolver;
