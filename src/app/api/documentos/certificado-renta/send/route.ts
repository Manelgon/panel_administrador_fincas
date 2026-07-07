import { createDocSendRoute } from "@/lib/api/docSend";

// POST /api/documentos/certificado-renta/send  —  Body: { submissionId, toEmail }
export const POST = createDocSendRoute({ type: "certificado-renta", defaultFilename: "certificado.pdf" });
