import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CONFIDENCE_THRESHOLD, scaleReader, type ReadingKind } from "@/lib/scale-reader";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("photo");
  const kind = (form.get("kind") === "karat" ? "karat" : "scale") as ReadingKind;
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo attached." }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Use a JPEG, PNG or WebP photo." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo is over 5 MB. Retake at a lower size." }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const reader = scaleReader();

  let result;
  try {
    result = await reader.read({ bytes, mime: file.type }, kind);
  } catch (err) {
    console.error("scale reader failed", { provider: reader.name, message: (err as Error).message });
    result = { weight: null, purity: null, confidence: 0, notes: "The reader is unavailable. Type the value.", raw: { error: true } };
  }

  const reading = await db.scaleReading.create({
    data: {
      photo: bytes,
      photoMime: file.type,
      provider: reader.name,
      readWeight: result.weight,
      readPurityPct: result.purity,
      confidence: result.confidence.toFixed(3),
      rawResponse: JSON.parse(JSON.stringify(result.raw ?? null)),
    },
    select: { id: true },
  });

  await db.auditEvent.create({
    data: {
      actorId: session.user.id,
      action: "reading.captured",
      entityType: "ScaleReading",
      entityId: reading.id,
      details: { provider: reader.name, confidence: result.confidence, kind },
    },
  });

  return NextResponse.json({
    id: reading.id,
    weight: result.weight,
    purity: result.purity,
    confidence: result.confidence,
    sure: result.confidence >= CONFIDENCE_THRESHOLD && (result.weight !== null || result.purity !== null),
    notes: result.notes,
    provider: reader.name,
  });
}
