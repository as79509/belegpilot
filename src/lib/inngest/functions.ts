import { inngest } from "./client";

// Phase 2: Document processing pipeline
export const processDocument = inngest.createFunction(
  {
    id: "process-document",
    name: "Process Document",
    triggers: [{ event: "document/uploaded" }],
  },
  async ({ event, step }) => {
    // Will be implemented in Phase 2
    // Steps: OCR → AI Normalization → Validation → Decision
  }
);

// Phase 4: Export to accounting system
export const exportDocument = inngest.createFunction(
  {
    id: "export-document",
    name: "Export Document",
    triggers: [{ event: "document/export-requested" }],
  },
  async ({ event, step }) => {
    // Will be implemented in Phase 4
  }
);
