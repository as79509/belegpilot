import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (session.user.role !== "admin")
      return NextResponse.json({ error: "Nur Administratoren" }, { status: 403 });

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
      } catch {}
    }

    console.log(`[Reset-Stuck] Reset ${stuck.length} documents, submitted ${submitted} for reprocessing`);

    return NextResponse.json({ found: stuck.length, submitted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
