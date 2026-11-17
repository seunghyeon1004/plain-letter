import type { FirebaseOptions } from "firebase/app";

/**
 * Firebase web config. This is public by design (it identifies the project;
 * it is not a secret). Access to Gemini is protected by App Check with
 * reCAPTCHA Enterprise, enforced in the Firebase console.
 *
 * VITE_FIREBASE_CONFIG (JSON) overrides it, which the end-to-end tests use
 * with a dummy project.
 */
const COMMITTED: FirebaseOptions | null = null;

/** reCAPTCHA Enterprise site key (public, bound to the hosting domains). */
const COMMITTED_RECAPTCHA_SITE_KEY: string | null = null;

function fromEnv(): FirebaseOptions | null {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FirebaseOptions;
  } catch {
    return null;
  }
}

export const FIREBASE_CONFIG: FirebaseOptions | null = fromEnv() ?? COMMITTED;
export const RECAPTCHA_SITE_KEY: string | null = (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined) ?? COMMITTED_RECAPTCHA_SITE_KEY;

/**
 * App Check debug token: development builds only, read from a gitignored env
 * file (.env.local: VITE_APPCHECK_DEBUG_TOKEN=...). Never set in production builds.
 */
export const APPCHECK_DEBUG_TOKEN: string | undefined = import.meta.env.DEV
  ? ((import.meta.env.VITE_APPCHECK_DEBUG_TOKEN as string | undefined) ?? undefined)
  : undefined;
