import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import type { StorageService } from "./storage.interface";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "documents";

export class SupabaseStorageService implements StorageService {
  /**
   * Upload a file to Supabase Storage.
   * Path format: {companyId}/{year}/{month}/{uuid}-{originalFileName}
   */
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
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    return storagePath;
  }

  /**
   * Download a file from Supabase Storage.
   */
  async retrieve(storagePath: string): Promise<Buffer> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);

    if (error || !data) {
      throw new Error(`Storage download failed: ${error?.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Create a signed URL for temporary access (e.g. PDF preview).
   * Default expiry: 1 hour (3600 seconds).
   */
  async getSignedUrl(
    storagePath: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error || !data?.signedUrl) {
      throw new Error(`Signed URL creation failed: ${error?.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Delete a file from Supabase Storage.
   */
  async delete(storagePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([storagePath]);

    if (error) {
      throw new Error(`Storage delete failed: ${error.message}`);
    }
  }
}
