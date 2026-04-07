import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SupabaseStorageService } from "@/lib/services/storage/supabase-storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const { id } = await params;

  const file = await prisma.documentFile.findFirst({
    where: {
      documentId: id,
      document: { companyId: session.user.companyId },
    },
  });

  if (!file) {
    return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
  }

  const storage = new SupabaseStorageService();
  const signedUrl = await storage.getSignedUrl(file.filePath, 3600);

  return NextResponse.redirect(signedUrl);
}
