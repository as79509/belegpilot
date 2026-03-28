import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import type { StorageService } from "./storage.interface";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "Documents";

export class SupabaseStorageService implements StorageService {
  async store(
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string,
    companyId?: string
  ): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = companyId || "default";
    const storagePath = `${prefix}/${year}/${month}/${uuidv4()}-${fileName}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error("[Storage] Upload failed:", {
        bucket: BUCKET,
        path: storagePath,
        error: JSON.stringify(error),
        statusCode: (error as any).statusCode,
      });
      throw new Error(
        `Storage upload failed (bucket: "${BUCKET}"): ${error.message}`
      );
    }

    return storagePath;
  }

  async retrieve(storagePath: string): Promise<Buffer> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);

    if (error || !data) {
      console.error("[Storage] Download failed:", {
        bucket: BUCKET,
        path: storagePath,
        error: JSON.stringify(error),
      });
      throw new Error(
        `Storage download failed (bucket: "${BUCKET}"): ${error?.message}`
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getSignedUrl(
    storagePath: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error || !data?.signedUrl) {
      console.error("[Storage] Signed URL failed:", {
        bucket: BUCKET,
        path: storagePath,
        error: JSON.stringify(error),
      });
      throw new Error(
        `Signed URL creation failed (bucket: "${BUCKET}"): ${error?.message}`
      );
    }

    return data.signedUrl;
  }

  async delete(storagePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([storagePath]);

    if (error) {
      console.error("[Storage] Delete failed:", {
        bucket: BUCKET,
        path: storagePath,
        error: JSON.stringify(error),
      });
      throw new Error(
        `Storage delete failed (bucket: "${BUCKET}"): ${error.message}`
      );
    }
  }
}
