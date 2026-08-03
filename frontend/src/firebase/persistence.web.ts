import { browserLocalPersistence } from "firebase/auth";

/** Web counterpart of the native AsyncStorage persistence — backed by localStorage. */
export const authPersistence = browserLocalPersistence;
