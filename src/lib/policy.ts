import type { Prisma } from "@/generated/prisma/client";
import type { DriftPolicy } from "@/lib/gold/loss-drift";
import { DEFAULT_DRIFT_POLICY } from "@/lib/gold/loss-drift";

type Reader = Pick<Prisma.TransactionClient, "setting">;

// Business thresholds live in the settings table so the finance head can tune them without a deploy.
export const SETTING_KEYS = {
  driftMinHistoryJobs: "drift.minHistoryJobs",
  driftPoints: "drift.points",
  oldGoldPanThresholdInr: "oldGold.panThresholdInr",
  workshopTimeZone: "workshop.timeZone",
} as const;

export const DEFAULT_SETTINGS: Record<string, string> = {
  [SETTING_KEYS.driftMinHistoryJobs]: String(DEFAULT_DRIFT_POLICY.minHistoryJobs),
  [SETTING_KEYS.driftPoints]: String(DEFAULT_DRIFT_POLICY.driftPoints),
  [SETTING_KEYS.oldGoldPanThresholdInr]: "200000",
  [SETTING_KEYS.workshopTimeZone]: "Asia/Kolkata",
};

export async function readSetting(db: Reader, key: string): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? DEFAULT_SETTINGS[key];
}

export async function readDriftPolicy(db: Reader): Promise<DriftPolicy> {
  const [minHistoryJobs, driftPoints] = await Promise.all([
    readSetting(db, SETTING_KEYS.driftMinHistoryJobs),
    readSetting(db, SETTING_KEYS.driftPoints),
  ]);
  return { minHistoryJobs: Number(minHistoryJobs), driftPoints };
}
