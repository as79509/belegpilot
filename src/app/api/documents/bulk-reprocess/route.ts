import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { documentIds } = await request.json();
    if (!documentIds?.length) {
      return NextResponse.json({ error: "No documents specified" }, { status: 400 });
    }

    const docs = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        companyId: session.user.companyId,
        status: { in: ["uploaded", "failed", "needs_review"] },
      },
      select: { id: true },
    });

    let submitted = 0;
    for (const doc of docs) {
      await prisma.document.update({
        where: { id: doc.id },
        data: { status: "uploaded" },
      });
      try {
        await inngest.send({
          name: "document/uploaded",
          data: { documentId: doc.id },
        });
        submitted++;
      } catch {
        // Continue even if Inngest fails for one
      }
    }

    return NextResponse.json({ submitted, total: docs.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
