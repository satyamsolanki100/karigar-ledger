import { AnthropicScaleReader } from "./anthropic-reader";
import { MockScaleReader, type ScaleReader } from "./reader";

export { CONFIDENCE_THRESHOLD, type ReadingKind, type ScaleReadingResult } from "./reader";

let reader: ScaleReader | undefined;

/** SCALE_READER=claude needs ANTHROPIC_API_KEY; anything else, or no key, falls back to the mock. */
export function scaleReader(): ScaleReader {
  if (reader) return reader;
  const wantClaude = process.env.SCALE_READER === "claude";
  reader = wantClaude && process.env.ANTHROPIC_API_KEY ? new AnthropicScaleReader() : new MockScaleReader();
  if (wantClaude && !process.env.ANTHROPIC_API_KEY) {
    console.warn("SCALE_READER=claude but ANTHROPIC_API_KEY is empty; using the mock reader");
  }
  return reader;
}
