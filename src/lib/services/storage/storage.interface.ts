export interface StorageService {
  store(
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<string>; // returns storage path
  retrieve(storagePath: string): Promise<Buffer>;
  getSignedUrl(storagePath: string, expiresIn?: number): Promise<string>;
  delete(storagePath: string): Promise<void>;
}
