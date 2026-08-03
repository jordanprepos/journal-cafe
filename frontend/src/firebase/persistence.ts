import AsyncStorage from "@react-native-async-storage/async-storage";
// `getReactNativePersistence` ships only on firebase/auth's "react-native" export
// condition, which Metro resolves but the package's default .d.ts doesn't declare.
// @ts-expect-error -- present at runtime on native, missing from the public types.
import { getReactNativePersistence } from "firebase/auth";

/** Keeps the signed-in user across app restarts on iOS/Android. */
export const authPersistence = getReactNativePersistence(AsyncStorage);
