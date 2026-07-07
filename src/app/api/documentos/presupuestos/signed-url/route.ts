import { createDocSubmissionSignedUrlRoute } from "@/lib/api/signedUrl";

// GET /api/documentos/presupuestos/signed-url?id={submissionId}&format=pdf|docx
export const GET = createDocSubmissionSignedUrlRoute({ allowDocx: true });
