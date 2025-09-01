// types/nav.ts
export const VIEW_KEYS = [
  'overview',
  'inventory',
  'transfer_platform',
  'transfer_requests',
  'dashboard',
  'analytics',
  'debug',
] as const;

export type ViewKey = typeof VIEW_KEYS[number];
