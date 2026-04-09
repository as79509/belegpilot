import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import {
  getCompanyActions,
  getDocumentActions,
  getPeriodActions,
} from "@/lib/services/actions/next-action";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const scope = searchParams.get("scope");
  const id = searchParams.get("id");

  if (!scope) {
    return NextResponse.json({ error: "scope ist erforderlich" }, { status: 400 });
  }

  switch (scope) {
    case "document": {
      if (!id) return NextResponse.json({ error: "id ist erforderlich" }, { status: 400 });
      const actions = await getDocumentActions(ctx.companyId, id);
      return NextResponse.json({ actions });
    }
    case "period": {
      if (!id) return NextResponse.json({ error: "id ist erforderlich" }, { status: 400 });
      const actions = await getPeriodActions(ctx.companyId, id);
      return NextResponse.json({ actions });
    }
    case "company": {
      const actions = await getCompanyActions(ctx.companyId);
      return NextResponse.json({ actions });
    }
    default:
      return NextResponse.json(
        { error: "Ungültiger scope (erlaubt: document, period, company)" },
        { status: 400 }
      );
  }
}
