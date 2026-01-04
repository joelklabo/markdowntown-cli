export type UploadPlan =
  | { mode: "direct"; url: string }
  | { mode: "presigned"; uploads: PresignedUpload[] };

export type PresignedUpload = {
  hash: string;
  url: string;
  method: "PUT" | "POST";
  headers?: Record<string, string>;
  storageKey: string;
  expiresIn: number;
  multipart?: {
    uploadId: string;
    parts: Array<{ partNumber: number; url: string }>;
  };
};

const BUCKET_ENV = "CLI_UPLOAD_BUCKET";
const REGION_ENV = "AWS_REGION";

export function isS3Configured(): boolean {
  return Boolean(process.env[BUCKET_ENV] && process.env[REGION_ENV]);
}

export function storageKeyForHash(hash: string): string {
  return `cli/blobs/${hash}`;
}

export async function buildUploadPlan(options: {
  origin: string;
  blobs: Array<{ hash: string; sizeBytes: number }>;
}): Promise<UploadPlan> {
  const direct = { mode: "direct" as const, url: `${options.origin}/api/cli/upload/blob` };

  if (!isS3Configured()) {
    return direct;
  }

  // Presigned + multipart uploads should be implemented with the AWS SDK once
  // we configure credentials and bucket settings in the environment. The
  // expected flow is:
  // 1) Use @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner to create
  //    pre-signed PUT URLs for small blobs.
  // 2) For large blobs, initiate multipart uploads and return part URLs.
  // 3) Store the resulting storageKey on the Blob record when the CLI
  //    registers the upload completion.
  // Until AWS integration is wired up, fall back to direct uploads.
  return direct;
}
