// Storage utilities for uploading spell code to R2/S3
import { createHash } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Configure S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'spell-platform';

export interface UploadSpellCodeParams {
  spellKey: string;
  code: string | Buffer;
  runtime: string;
  contentType?: string;
}

export interface UploadSpellCodeResult {
  codeUrl: string;
  codeHash: string;
}

/**
 * Upload spell code to R2 storage
 * @param params Upload parameters
 * @returns URL and hash of uploaded code
 */
export async function uploadSpellCode(
  params: UploadSpellCodeParams
): Promise<UploadSpellCodeResult> {
  const { spellKey, code, runtime, contentType } = params;

  // Convert string to Buffer if needed
  const buffer = typeof code === 'string' ? Buffer.from(code, 'utf-8') : code;

  // Calculate SHA-256 hash
  const hash = createHash('sha256');
  hash.update(buffer);
  const codeHash = hash.digest('hex');

  // Determine file extension based on runtime
  const extension = getFileExtension(runtime);
  const key = `spells/${spellKey}/code${extension}`;

  // Upload to R2
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType || getContentType(runtime),
      Metadata: {
        'spell-key': spellKey,
        runtime,
        'code-hash': codeHash,
      },
    })
  );

  // Construct public URL
  const codeUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;

  return {
    codeUrl,
    codeHash,
  };
}

function getFileExtension(runtime: string): string {
  switch (runtime) {
    case 'wasm':
      return '.wasm';
    case 'node':
    case 'nodejs':
      return '.js';
    case 'python':
      return '.py';
    case 'deno':
      return '.ts';
    default:
      return '.txt';
  }
}

function getContentType(runtime: string): string {
  switch (runtime) {
    case 'wasm':
      return 'application/wasm';
    case 'node':
    case 'nodejs':
    case 'deno':
      return 'application/javascript';
    case 'python':
      return 'text/x-python';
    default:
      return 'text/plain';
  }
}
