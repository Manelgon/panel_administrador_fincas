import { createDocSubmissionSignedUrlRoute } from "@/lib/api/signedUrl";

// GET /api/documentos/certificado-renta/signed-url?id={submissionId}
export const GET = createDocSubmissionSignedUrlRoute();
