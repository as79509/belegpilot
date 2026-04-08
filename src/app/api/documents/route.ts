import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { companyId } = ctx;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const amountFrom = searchParams.get("amountFrom");
  const amountTo = searchParams.get("amountTo");
  const supplierId = searchParams.get("supplierId");
  const currency = searchParams.get("currency");
  const exportStatus = searchParams.get("exportStatus");
  const confidenceMin = searchParams.get("confidenceMin");
  const confidenceMax = searchParams.get("confidenceMax");
  const documentType = searchParams.get("documentType");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

  const where: Record<string, any> = { companyId };

  if (status) where.status = status;
  if (documentType) where.documentType = documentType;
  if (supplierId) where.supplierId = supplierId;
  if (currency) where.currency = currency;

  if (exportStatus === "exported") where.exportStatus = "exported";
  if (exportStatus === "not_exported") where.exportStatus = "not_exported";

  if (dateFrom || dateTo) {
    where.invoiceDate = {};
    if (dateFrom) where.invoiceDate.gte = new Date(dateFrom);
    if (dateTo) where.invoiceDate.lte = new Date(dateTo + "T23:59:59Z");
  }

  if (amountFrom || amountTo) {
    where.grossAmount = {};
    if (amountFrom) where.grossAmount.gte = parseFloat(amountFrom);
    if (amountTo) where.grossAmount.lte = parseFloat(amountTo);
  }

  if (confidenceMin || confidenceMax) {
    where.confidenceScore = {};
    if (confidenceMin) where.confidenceScore.gte = parseFloat(confidenceMin);
    if (confidenceMax) where.confidenceScore.lte = parseFloat(confidenceMax);
  }

  if (search) {
    where.OR = [
      { supplierNameRaw: { contains: search, mode: "insensitive" } },
      { supplierNameNormalized: { contains: search, mode: "insensitive" } },
      { invoiceNumber: { contains: search, mode: "insensitive" } },
      { documentNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where: where as any,
      include: {
        file: { select: { fileName: true, mimeType: true } },
        supplier: { select: { id: true, nameNormalized: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.document.count({ where: where as any }),
  ]);

  return NextResponse.json({
    documents,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
