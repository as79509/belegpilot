import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const timestamp = Date.now();
    const ext = file.name.split(".").pop() || "pdf";
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .slice(0, 50);
    const storagePath = `onboarding/${user.id}/${draftId || "temp"}/${timestamp}_${sanitizedName}`;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[Onboarding Upload] Storage error:", uploadError);
      return NextResponse.json(
        { error: "Fehler beim Hochladen" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(storagePath);

    // Store reference in onboarding draft if draftId provided
    if (draftId) {
      // Update the draft's data to include this file
      const { data: draft, error: draftError } = await supabase
        .from("onboarding_drafts")
        .select("data")
        .eq("id", draftId)
        .eq("user_id", user.id)
        .single();

      if (!draftError && draft) {
        const currentData = (draft.data as Record<string, unknown>) || {};
        const existingFiles = (currentData.uploadedFiles as Array<{
          id: string;
          name: string;
          type: string;
          size: number;
          path: string;
          url: string;
        }>) || [];
        
        const newFile = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          path: storagePath,
          url: urlData.publicUrl,
        };

        await supabase
          .from("onboarding_drafts")
          .update({
            data: {
              ...currentData,
              uploadedFiles: [...existingFiles, newFile],
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", draftId)
          .eq("user_id", user.id);

        return NextResponse.json({
          id: newFile.id,
          url: urlData.publicUrl,
          path: storagePath,
          fileName: file.name,
          status: "uploaded",
        });
      }
    }

    return NextResponse.json({
      id: crypto.randomUUID(),
      url: urlData.publicUrl,
      path: storagePath,
      fileName: file.name,
      status: "uploaded",
    });
  } catch (error: unknown) {
    console.error("[Onboarding Upload] Error:", error);
    const message = error instanceof Error ? error.message : "Upload fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
