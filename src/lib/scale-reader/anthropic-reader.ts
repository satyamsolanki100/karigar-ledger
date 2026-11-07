import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ReadingKind, ScaleReader, ScaleReadingResult } from "./reader";

const readingSchema = z.object({
  weight_g: z.number().nonnegative().nullable(),
  purity_pct: z.number().min(0).max(100).nullable(),
  confidence: z.number().min(0).max(1),
  notes: z.string().max(300).default(""),
});

const SYSTEM = `You read photos taken in a jewellery workshop for a gold ledger.
A "scale" photo shows a digital weighing scale display. A "karat" photo shows a karat meter (XRF purity tester) screen or printout.
Report only what is legible on the display. Never estimate a number that is not shown.
Reply with one JSON object and nothing else:
{"weight_g": number|null, "purity_pct": number|null, "confidence": 0..1, "notes": string}
- weight_g: the displayed weight in grams, to 3 decimals. If the unit shown is not grams, convert and say so in notes. null if no weight is visible.
- purity_pct: purity as a percentage to 2 decimals. Karat meters may show karat (22K = 91.60) or "Au %" directly. null if none is visible.
- confidence: how sure you are that every digit, including the decimal point, is read correctly. Use 0.5 or lower if any digit is blurred, cut off, glared, or if the display is mid-change.
- notes: one short sentence on anything a clerk should double-check.`;

type SupportedMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export class AnthropicScaleReader implements ScaleReader {
  readonly name = "claude-opus-5-5";
  private readonly client = new Anthropic();

  async read(image: { bytes: Buffer; mime: string }, kind: ReadingKind): Promise<ScaleReadingResult> {
    const response = await this.client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 512,
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mime as SupportedMime, data: image.bytes.toString("base64") } },
            { type: "text", text: `This is a ${kind === "scale" ? "weighing scale display" : "karat meter reading"}. Read it.` },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return { weight: null, purity: null, confidence: 0, notes: "The model declined to read this photo. Type the value.", raw: response };
    }

    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    const parsed = json ? readingSchema.safeParse(JSON.parse(json)) : null;
    if (!parsed || !parsed.success) {
      return { weight: null, purity: null, confidence: 0, notes: "Could not understand the reading. Type the value.", raw: text };
    }
    const r = parsed.data;
    return {
      weight: r.weight_g === null ? null : r.weight_g.toFixed(3),
      purity: r.purity_pct === null ? null : r.purity_pct.toFixed(2),
      confidence: r.confidence,
      notes: r.notes,
      raw: { text, usage: response.usage },
    };
  }
}
