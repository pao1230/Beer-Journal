import { db } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/photos/[id]">) {
  const id = Number((await ctx.params).id);
  const photo = Number.isInteger(id)
    ? await db.photo.findUnique({ where: { id }, select: { data: true, mimeType: true } })
    : null;
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
