export interface PdfPage {
  pageNumber: number;
  imageBuffer: Buffer;
}

/**
 * For image files (JPEG/PNG), wrap into PdfPage format.
 * For PDFs, we send directly to Claude as a document — no conversion needed.
 */
export function wrapImageAsPage(imageBuffer: Buffer): PdfPage[] {
  return [{ pageNumber: 1, imageBuffer }];
}
