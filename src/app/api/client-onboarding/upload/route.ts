import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

/**
 * Onboarding Document Upload API
 * 
 * Uploads files to Supabase Storage for the onboarding wizard.
 * Files are stored under onboarding/{userId}/{draftId}/ path.
 * 
 * The frontend is responsible for updating the draft data with file info
 * via the main /api/client-onboarding endpoint.
 */

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg", 
  "image/png",
  "image/heic",
];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const draftId = formData.get("draftId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei ausgewählt" }, { status: 400 });
    }

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Ungültiger Dateityp: ${file.type}. Erlaubt sind PDF, JPG, PNG.` },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Datei zu gross (max. 20 MB)" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileId = randomUUID();
    const timestamp = Date.now();
    const ext = file.name.split(".").pop() || "pdf";
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .slice(0, 50);
    const storagePath = `onboarding/${user.id}/${draftId || "temp"}/${timestamp}_${sanitizedName}`;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[Onboarding Upload] Storage error:", uploadError);
      return NextResponse.json(
        { error: "Fehler beim Hochladen: " + uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(storagePath);

    // Return file info - the frontend will save this to the draft
    return NextResponse.json({
      id: fileId,
      url: urlData.publicUrl,
      path: storagePath,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      status: "uploaded",
    });
  } catch (error: unknown) {
    console.error("[Onboarding Upload] Error:", error);
    const message = error instanceof Error ? error.message : "Upload fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
