import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const document = await prisma.document.findFirst({
      where: { id, companyId: session.user.companyId },
    });

    if (!document) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!["uploaded", "failed"].includes(document.status)) {
      return NextResponse.json(
        { error: "Dokument kann in diesem Status nicht erneut verarbeitet werden" },
        { status: 400 }
      );
    }

    // Reset status to uploaded
    await prisma.document.update({
      where: { id },
      data: { status: "uploaded" },
    });

    // Send Inngest event
    await inngest.send({
      name: "document/uploaded",
      data: { documentId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Reprocess] Error:", error);
    return NextResponse.json(
      { error: error.message || "Fehler beim erneuten Verarbeiten" },
      { status: 500 }
    );
  }
}
