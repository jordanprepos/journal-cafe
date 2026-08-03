import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";

import type { User } from "@/src/api/client";
import { auth } from "@/src/firebase/config";
import { useGoogleSignIn } from "@/src/firebase/google-signin";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  /** Resolves false if the user dismissed the Google sheet. */
  loginWithGoogle: () => Promise<boolean>;
  /** False until the Google OAuth request is ready — disable the button. */
  googleReady: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

function toUser(u: FirebaseUser): User {
  return {
    id: u.uid,
    email: u.email ?? "",
    // Google accounts carry a displayName; email/password ones get it at register.
    name: u.displayName ?? (u.email ? u.email.split("@")[0] : ""),
  };
}

/** Firebase throws codes like `auth/invalid-credential`; screens render e.message raw. */
function friendlyAuthError(e: any): Error {
  const map: Record<string, string> = {
    "auth/invalid-credential": "That email or password isn't right.",
    "auth/invalid-email": "That doesn't look like a valid email address.",
    "auth/user-not-found": "That email or password isn't right.",
    "auth/wrong-password": "That email or password isn't right.",
    "auth/email-already-in-use": "An account with that email already exists.",
    "auth/weak-password": "Please choose a password of at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please try again in a moment.",
    "auth/network-request-failed": "Couldn't reach Firebase. Check your connection.",
    "auth/operation-not-allowed":
      "That sign-in method isn't enabled on this Firebase project.",
  };
  return new Error(map[e?.code] ?? e?.message ?? "Something went wrong.");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const google = useGoogleSignIn();

  useEffect(() => {
    // Fires once on boot with the persisted session (or null), then on every
    // sign-in/out. Replaces the old bootstrap fetch of /auth/me.
    return onAuthStateChanged(auth, (u) => {
      setUser(u ? toUser(u) : null);
      setLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      throw friendlyAuthError(e);
    }
  }

  async function register(email: string, password: string, name: string) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      // updateProfile doesn't re-fire onAuthStateChanged, so publish the name now.
      setUser(toUser(cred.user));
    } catch (e) {
      throw friendlyAuthError(e);
    }
  }

  async function loginWithGoogle() {
    try {
      return await google.signIn();
    } catch (e) {
      throw friendlyAuthError(e);
    }
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        loginWithGoogle,
        googleReady: google.ready,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
