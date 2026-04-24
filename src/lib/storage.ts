import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

import { sanitizeFilename } from "@/lib/utils";

const uploadsRoot = path.join(process.cwd(), "data", "uploads");

export async function ensureUploadsRoot() {
  await mkdir(uploadsRoot, { recursive: true });
  return uploadsRoot;
}

export async function saveIncomingFile(input: {
  file: File;
  clientId: string;
  documentId: string;
}) {
  const { file, clientId, documentId } = input;
  const clientDir = path.join(await ensureUploadsRoot(), clientId);
  await mkdir(clientDir, { recursive: true });

  const safeName = sanitizeFilename(file.name || "beleg");
  const targetPath = path.join(clientDir, `${documentId}-${safeName}`);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(targetPath, buffer);

  return {
    storedPath: targetPath,
    mimeType: file.type || "application/octet-stream",
    originalFilename: file.name || safeName,
    size: buffer.length,
  };
}

export async function saveTextFixture(input: {
  relativeName: string;
  content: string;
}) {
  const filePath = path.join(await ensureUploadsRoot(), input.relativeName);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, input.content, "utf8");
  return filePath;
}

export async function readStoredFile(storedPath: string) {
  return readFile(storedPath);
}

export async function deleteStoredFile(storedPath?: string | null) {
  if (!storedPath) {
    return;
  }

  await rm(storedPath, { force: true });
}
