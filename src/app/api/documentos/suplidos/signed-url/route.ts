import { createDocSubmissionSignedUrlRoute } from "@/lib/api/signedUrl";

// GET /api/documentos/suplidos/signed-url?id={submissionId}
export const GET = createDocSubmissionSignedUrlRoute();
