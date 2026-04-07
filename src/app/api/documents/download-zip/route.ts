import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SupabaseStorageService } from "@/lib/services/storage/supabase-storage";
import archiver from "archiver";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!["admin", "reviewer"].includes(session.user.role))
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

    const body = await request.json();
    let documentIds: string[] = body.documentIds || [];

    // If no specific IDs, use filter
    if (!documentIds.length) {
      const where: Record<string, any> = {
        companyId: session.user.companyId,
        status: { in: ["ready", "exported"] },
        file: { isNot: null },
      };
      if (body.filter === "exported") where.exportStatus = "exported";
      if (body.filter === "date-range" && body.dateFrom) {
        where.invoiceDate = { gte: new Date(body.dateFrom) };
        if (body.dateTo) where.invoiceDate.lte = new Date(body.dateTo + "T23:59:59Z");
      }

      const docs = await prisma.document.findMany({
        where: where as any,
        select: { id: true },
        take: 100,
      });
      documentIds = docs.map((d) => d.id);
    }

    if (!documentIds.length) {
      return NextResponse.json({ error: "Keine Belege gefunden" }, { status: 400 });
    }
    if (documentIds.length > 100) {
      return NextResponse.json({ error: "Maximal 100 Dateien pro Download" }, { status: 400 });
    }

    // Load documents with files
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds }, companyId: session.user.companyId },
      include: { file: true },
    });

    const storage = new SupabaseStorageService();

    // Build ZIP in memory
    const archive = archiver("zip", { zlib: { level: 5 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));

    const finishPromise = new Promise<void>((resolve, reject) => {
      archive.on("end", resolve);
      archive.on("error", reject);
    });

    for (const doc of documents) {
      if (!doc.file) continue;
      try {
        const fileBuffer = await storage.retrieve(doc.file.filePath);
        const supplier = (doc.supplierNameNormalized || doc.supplierNameRaw || "Unbekannt").replace(/[/\\:*?"<>|]/g, "_");
        const date = doc.invoiceDate ? `${doc.invoiceDate.getFullYear()}-${String(doc.invoiceDate.getMonth() + 1).padStart(2, "0")}-${String(doc.invoiceDate.getDate()).padStart(2, "0")}` : "";
        const ext = doc.file.fileName.split(".").pop() || "pdf";
        const zipName = `${doc.documentNumber || doc.id.slice(0, 8)}_${supplier}_${date}.${ext}`;
        archive.append(fileBuffer, { name: zipName });
      } catch (e) {
        console.warn(`[ZIP] Failed to add ${doc.id}:`, e);
      }
    }

    archive.finalize();
    await finishPromise;

    const zipBuffer = Buffer.concat(chunks);
    const today = new Date().toISOString().split("T")[0];

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="belegpilot-belege-${today}.zip"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
