import { createDocSubmissionSignedUrlRoute } from "@/lib/api/signedUrl";

// GET /api/documentos/varios/signed-url?id={submissionId}
export const GET = createDocSubmissionSignedUrlRoute();
