// Client-safe stale-guard settings (no .server suffix on purpose): shared by
// the Settings page (browser bundle) and the webhook/snapshot auto-clear
// flow (server). Thresholds are merchant-configured product requirements,
// not statutory day counts.
import { DEFAULT_STALE_THRESHOLDS } from "./pricing";

export interface GuardSettings {
  warnDays: number;
  reviewDays: number;
  staleDays: number;
  autoClear: boolean;
}

export const DEFAULT_GUARD_SETTINGS: GuardSettings = {
  ...DEFAULT_STALE_THRESHOLDS,
  autoClear: false,
};

export function parseGuardSettings(raw: unknown): GuardSettings {
  if (typeof raw !== "object" || raw === null) return DEFAULT_GUARD_SETTINGS;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v > 0
      ? Math.floor(v)
      : fallback;
  return {
    warnDays: num(r.warnDays, DEFAULT_GUARD_SETTINGS.warnDays),
    reviewDays: num(r.reviewDays, DEFAULT_GUARD_SETTINGS.reviewDays),
    staleDays: num(r.staleDays, DEFAULT_GUARD_SETTINGS.staleDays),
    autoClear: r.autoClear === true,
  };
}
