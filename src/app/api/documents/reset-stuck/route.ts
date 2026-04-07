import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { rateLimit } from "@/lib/rate-limit";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (session.user.role !== "admin")
      return NextResponse.json({ error: "Nur Administratoren" }, { status: 403 });

    const { allowed } = rateLimit(`reset-stuck:${session.user.id}`, 5, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Zu viele Anfragen. Bitte warten Sie einen Moment." }, { status: 429 });
    }

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Find documents stuck at 'processing' for more than 30 minutes
    const stuck = await prisma.document.findMany({
      where: {
        companyId: session.user.companyId,
        status: "processing",
        updatedAt: { lt: thirtyMinAgo },
      },
      select: { id: true },
    });

    let submitted = 0;
    for (const doc of stuck) {
      await prisma.document.update({
        where: { id: doc.id },
        data: { status: "uploaded" },
      });
      try {
        await inngest.send({ name: "document/uploaded", data: { documentId: doc.id } });
        submitted++;
      } catch (e) { console.warn("[ResetStuck] Inngest send failed for", doc.id, e); }
    }

    console.log(`[Reset-Stuck] Reset ${stuck.length} documents, submitted ${submitted} for reprocessing`);

    return NextResponse.json({ found: stuck.length, submitted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
