import { createHash } from "node:crypto";

export type ReadingKind = "scale" | "karat";

export type ScaleReadingResult = {
  /** Grams as a 3-decimal string, or null when the display could not be read. */
  weight: string | null;
  /** Purity percent as a 2-decimal string, or null when the photo has no purity. */
  purity: string | null;
  /** 0 to 1. Below the threshold the clerk types the value by hand. */
  confidence: number;
  notes: string;
  raw: unknown;
};

/** Port for whatever reads the photo. Adapters: Claude vision, and a mock for local dev and tests. */
export interface ScaleReader {
  readonly name: string;
  read(image: { bytes: Buffer; mime: string }, kind: ReadingKind): Promise<ScaleReadingResult>;
}

/** Brief: readings below this are shown as unsure and never auto-fill the form. */
export const CONFIDENCE_THRESHOLD = 0.75;

/**
 * Deterministic stand-in for local dev without an API key. It cannot read pixels; it derives a
 * plausible figure from the image hash so the same photo always yields the same reading, and
 * marks roughly one in five as unsure so the fallback path gets exercised.
 */
export class MockScaleReader implements ScaleReader {
  readonly name = "mock";

  async read(image: { bytes: Buffer }, kind: ReadingKind): Promise<ScaleReadingResult> {
    const digest = createHash("sha256").update(image.bytes).digest();
    const n = digest.readUInt32BE(0);
    const unsure = n % 5 === 0;
    const weight = (10 + (n % 25_000) / 100).toFixed(3);
    const purity = kind === "karat" ? (70 + (digest.readUInt16BE(4) % 3000) / 100).toFixed(2) : null;
    return {
      weight: kind === "scale" ? weight : null,
      purity,
      confidence: unsure ? 0.42 : 0.93,
      notes: unsure ? "Display partly out of frame (mock)" : "Mock reading derived from the photo hash",
      raw: { mock: true, hash: digest.toString("hex").slice(0, 16) },
    };
  }
}
