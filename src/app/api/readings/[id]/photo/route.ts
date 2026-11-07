import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const reading = await db.scaleReading.findUnique({ where: { id }, select: { photo: true, photoMime: true } });
  if (!reading) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(reading.photo), {
    headers: { "Content-Type": reading.photoMime, "Cache-Control": "private, max-age=3600" },
  });
}
