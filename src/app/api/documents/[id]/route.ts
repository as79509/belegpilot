import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: {
      id,
      companyId: session.user.companyId,
    },
    include: {
      file: true,
      ocrResult: true,
      aiResults: {
        orderBy: { version: "desc" },
        take: 1,
      },
      processingSteps: {
        orderBy: { startedAt: "asc" },
      },
      supplier: true,
      reviewer: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!document) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(document);
}
