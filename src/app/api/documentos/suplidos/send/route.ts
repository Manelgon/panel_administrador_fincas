import { createDocSendRoute } from "@/lib/api/docSend";

// POST /api/documentos/suplidos/send  —  Body: { submissionId, toEmail }
export const POST = createDocSendRoute({ type: "suplidos", defaultFilename: "suplidos.pdf" });
