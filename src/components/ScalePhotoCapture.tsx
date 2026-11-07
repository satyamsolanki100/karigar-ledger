"use client";

import { useRef, useState } from "react";
import { btnSecondary, Pill } from "@/components/ui";

export type ConfirmedReading = {
  id: string;
  weight: string | null;
  purity: string | null;
  confidence: number;
  notes: string;
  provider: string;
  previewUrl: string;
};

type ApiReading = Omit<ConfirmedReading, "previewUrl"> & { sure: boolean };

const MAX_EDGE = 1280;

/** Shared tablets on patchy networks: shrink the photo in the browser before it leaves the device. */
async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.type === "image/jpeg") return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
}

export function ScalePhotoCapture({
  kind,
  reading,
  onReading,
}: {
  kind: "scale" | "karat";
  reading: ConfirmedReading | null;
  onReading: (reading: ConfirmedReading | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [unsure, setUnsure] = useState<ApiReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUnsure(null);
    onReading(null);
    setBusy(true);
    const url = URL.createObjectURL(file);
    setPreview(url);
    try {
      const blob = await downscale(file);
      const body = new FormData();
      body.append("photo", blob, "photo.jpg");
      body.append("kind", kind);
      const res = await fetch("/api/readings", { method: "POST", body });
      const data = (await res.json()) as ApiReading & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      if (data.sure) {
        onReading({ ...data, previewUrl: url });
      } else {
        setUnsure(data);
      }
    } catch (err) {
      setError((err as Error).message || "Could not read the photo. Type the value instead.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPreview(null);
    setUnsure(null);
    setError(null);
    onReading(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const label = kind === "scale" ? "Scale display" : "Karat meter";

  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-paper/60 p-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        id={`photo-${kind}`}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {!preview ? (
        <label
          htmlFor={`photo-${kind}`}
          className="flex h-full min-h-40 cursor-pointer flex-col items-center justify-center gap-1 text-center"
        >
          <span className="text-sm font-medium">Photograph the {label.toLowerCase()}</span>
          <span className="text-xs text-ink-soft">The reading fills the form; you confirm it before saving.</span>
          <span className={`${btnSecondary} mt-3`}>Take photo</span>
        </label>
      ) : (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={`${label} photo`} className="max-h-48 w-full rounded-md object-contain bg-ink/5" />
          {busy ? (
            <p className="text-sm text-ink-soft">Reading the display…</p>
          ) : reading ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="ok">Read from photo</Pill>
                <span className="text-xs text-ink-faint">
                  {Math.round(reading.confidence * 100)}% sure · {reading.provider}
                </span>
              </div>
              <p className="num text-sm">
                {reading.weight ? <>Weight <strong>{reading.weight} g</strong></> : null}
                {reading.weight && reading.purity ? " · " : null}
                {reading.purity ? <>Purity <strong>{reading.purity} %</strong></> : null}
              </p>
              {reading.notes ? <p className="text-xs text-ink-soft">{reading.notes}</p> : null}
            </div>
          ) : unsure ? (
            <div className="space-y-1">
              <Pill tone="warn">Not sure, type it</Pill>
              <p className="text-xs text-ink-soft">
                {unsure.weight ? `Best guess ${unsure.weight} g, ` : ""}
                {Math.round(unsure.confidence * 100)}% sure. {unsure.notes}
              </p>
            </div>
          ) : error ? (
            <p className="text-sm text-bad">{error}</p>
          ) : null}
          <div className="flex gap-2">
            <label htmlFor={`photo-${kind}`} className={`${btnSecondary} cursor-pointer px-2.5 py-1.5 text-xs`}>
              Retake
            </label>
            <button type="button" onClick={reset} className="text-xs text-ink-soft underline-offset-2 hover:underline">
              Remove photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
