// Centralized list of in-app view keys used by sidebar routing and page switch.
// NOTE: Added 'history' to support the new History/Audit page.

export const VIEW_KEYS = [
  'overview',
  'inventory',
  'transfer_platform',
  'transfer_requests',
  'dashboard',
  'analytics',
  'history',      // <-- added
  'debug',
] as const;

export type ViewKey = typeof VIEW_KEYS[number];

// Optional: a safe default view for the app router
export const DEFAULT_VIEW: ViewKey = 'overview';

// Helper: type guard to validate external inputs (e.g., query params)
export function isViewKey(v: string | null | undefined): v is ViewKey {
  return !!v && (VIEW_KEYS as readonly string[]).includes(v);
}
