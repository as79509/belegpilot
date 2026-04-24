import { NextResponse } from "next/server";

import { seedDemoData } from "@/lib/demo";

export async function POST() {
  try {
    const client = await seedDemoData();
    return NextResponse.json({ clientId: client.id });
  } catch {
    return NextResponse.json({ error: "Demo Daten konnten nicht angelegt werden." }, { status: 400 });
  }
}
