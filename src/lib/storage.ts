import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
  type DeleteObjectCommandInput,
  type ListObjectsV2CommandInput,
  type HeadObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageConfigError';
  }
}

export class StorageOperationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'StorageOperationError';
  }
}

/**
 * Artifact metadata stored in R2
 */
export interface ArtifactMetadata {
  castId: string;
  filename: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
  uploadedBy: string;
}

/**
 * Artifact file information
 */
export interface ArtifactFile {
  key: string;
  filename: string;
  size: number;
  contentType: string;
  lastModified: Date;
}

/**
 * Upload artifact options
 */
export interface UploadArtifactOptions {
  castId: string;
  filename: string;
  content: Buffer | Uint8Array | string;
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * Download artifact options
 */
export interface DownloadArtifactOptions {
  castId: string;
  filename: string;
}

/**
 * Get signed URL options
 */
export interface SignedUrlOptions {
  castId: string;
  filename: string;
  expiresIn?: number; // seconds, default 3600 (1 hour)
  download?: boolean; // if true, sets Content-Disposition to attachment
}

let s3Client: S3Client | null = null;

/**
 * Get or initialize S3 client for Cloudflare R2
 */
function getS3Client(): S3Client {
  if (s3Client) {
    return s3Client;
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId) {
    throw new StorageConfigError('Missing R2_ACCOUNT_ID environment variable');
  }

  if (!accessKeyId) {
    throw new StorageConfigError('Missing R2_ACCESS_KEY_ID environment variable');
  }

  if (!secretAccessKey) {
    throw new StorageConfigError('Missing R2_SECRET_ACCESS_KEY environment variable');
  }

  // Cloudflare R2 endpoint format: https://<account_id>.r2.cloudflarestorage.com
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  s3Client = new S3Client({
    region: 'auto', // R2 uses 'auto' as the region
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return s3Client;
}

/**
 * Get bucket name from environment
 */
function getBucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new StorageConfigError('Missing R2_BUCKET_NAME environment variable');
  }
  return bucketName;
}

/**
 * Generate R2 object key for artifact
 */
export function generateArtifactKey(castId: string, filename: string): string {
  // Structure: casts/{castId}/{filename}
  return `casts/${castId}/${filename}`;
}

/**
 * Upload artifact to R2
 */
export async function uploadArtifact(options: UploadArtifactOptions): Promise<string> {
  try {
    const client = getS3Client();
    const bucketName = getBucketName();
    const key = generateArtifactKey(options.castId, options.filename);

    // Detect content type if not provided
    const contentType = options.contentType || detectContentType(options.filename);

    // Prepare metadata
    const metadata = {
      castId: options.castId,
      filename: options.filename,
      uploadedAt: new Date().toISOString(),
      ...options.metadata,
    };

    const params: PutObjectCommandInput = {
      Bucket: bucketName,
      Key: key,
      Body: options.content,
      ContentType: contentType,
      Metadata: metadata,
    };

    const command = new PutObjectCommand(params);
    await client.send(command);

    return key;
  } catch (error) {
    throw new StorageOperationError(
      `Failed to upload artifact: ${options.filename}`,
      error
    );
  }
}

/**
 * Download artifact from R2
 */
export async function downloadArtifact(options: DownloadArtifactOptions): Promise<Buffer> {
  try {
    const client = getS3Client();
    const bucketName = getBucketName();
    const key = generateArtifactKey(options.castId, options.filename);

    const params: GetObjectCommandInput = {
      Bucket: bucketName,
      Key: key,
    };

    const command = new GetObjectCommand(params);
    const response = await client.send(command);

    if (!response.Body) {
      throw new StorageOperationError('Artifact body is empty');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    throw new StorageOperationError(
      `Failed to download artifact: ${options.filename}`,
      error
    );
  }
}

/**
 * Generate signed URL for artifact download
 */
export async function getArtifactUrl(options: SignedUrlOptions): Promise<string> {
  try {
    const client = getS3Client();
    const bucketName = getBucketName();
    const key = generateArtifactKey(options.castId, options.filename);
    const expiresIn = options.expiresIn || 3600; // default 1 hour

    const params: GetObjectCommandInput = {
      Bucket: bucketName,
      Key: key,
    };

    // Add Content-Disposition header for downloads
    if (options.download) {
      params.ResponseContentDisposition = `attachment; filename="${options.filename}"`;
    }

    const command = new GetObjectCommand(params);
    const signedUrl = await getSignedUrl(client, command, { expiresIn });

    return signedUrl;
  } catch (error) {
    throw new StorageOperationError(
      `Failed to generate signed URL for: ${options.filename}`,
      error
    );
  }
}

/**
 * Delete artifact from R2
 */
export async function deleteArtifact(options: DownloadArtifactOptions): Promise<void> {
  try {
    const client = getS3Client();
    const bucketName = getBucketName();
    const key = generateArtifactKey(options.castId, options.filename);

    const params: DeleteObjectCommandInput = {
      Bucket: bucketName,
      Key: key,
    };

    const command = new DeleteObjectCommand(params);
    await client.send(command);
  } catch (error) {
    throw new StorageOperationError(
      `Failed to delete artifact: ${options.filename}`,
      error
    );
  }
}

/**
 * List all artifacts for a cast
 */
export async function listArtifacts(castId: string): Promise<ArtifactFile[]> {
  try {
    const client = getS3Client();
    const bucketName = getBucketName();
    const prefix = `casts/${castId}/`;

    const params: ListObjectsV2CommandInput = {
      Bucket: bucketName,
      Prefix: prefix,
    };

    const command = new ListObjectsV2Command(params);
    const response = await client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      return [];
    }

    return response.Contents.map((item) => {
      const filename = item.Key?.replace(prefix, '') || 'unknown';
      return {
        key: item.Key || '',
        filename,
        size: item.Size || 0,
        contentType: 'application/octet-stream', // S3 doesn't return ContentType in list
        lastModified: item.LastModified || new Date(),
      };
    });
  } catch (error) {
    throw new StorageOperationError(
      `Failed to list artifacts for cast: ${castId}`,
      error
    );
  }
}

/**
 * Get artifact metadata
 */
export async function getArtifactMetadata(options: DownloadArtifactOptions): Promise<{
  size: number;
  contentType: string;
  lastModified: Date;
  metadata: Record<string, string>;
}> {
  try {
    const client = getS3Client();
    const bucketName = getBucketName();
    const key = generateArtifactKey(options.castId, options.filename);

    const params: HeadObjectCommandInput = {
      Bucket: bucketName,
      Key: key,
    };

    const command = new HeadObjectCommand(params);
    const response = await client.send(command);

    return {
      size: response.ContentLength || 0,
      contentType: response.ContentType || 'application/octet-stream',
      lastModified: response.LastModified || new Date(),
      metadata: response.Metadata || {},
    };
  } catch (error) {
    throw new StorageOperationError(
      `Failed to get metadata for artifact: ${options.filename}`,
      error
    );
  }
}

/**
 * Delete all artifacts for a cast
 */
export async function deleteAllArtifactsForCast(castId: string): Promise<number> {
  try {
    const artifacts = await listArtifacts(castId);

    if (artifacts.length === 0) {
      return 0;
    }

    // Delete each artifact
    await Promise.all(
      artifacts.map((artifact) =>
        deleteArtifact({
          castId,
          filename: artifact.filename,
        })
      )
    );

    return artifacts.length;
  } catch (error) {
    throw new StorageOperationError(
      `Failed to delete all artifacts for cast: ${castId}`,
      error
    );
  }
}

/**
 * Check if artifact exists
 */
export async function artifactExists(options: DownloadArtifactOptions): Promise<boolean> {
  try {
    await getArtifactMetadata(options);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get total storage size for a cast
 */
export async function getCastStorageSize(castId: string): Promise<number> {
  try {
    const artifacts = await listArtifacts(castId);
    return artifacts.reduce((total, artifact) => total + artifact.size, 0);
  } catch (error) {
    throw new StorageOperationError(
      `Failed to calculate storage size for cast: ${castId}`,
      error
    );
  }
}

/**
 * Detect content type from filename
 */
function detectContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  const contentTypeMap: Record<string, string> = {
    json: 'application/json',
    txt: 'text/plain',
    log: 'text/plain',
    html: 'text/html',
    xml: 'application/xml',
    zip: 'application/zip',
    tar: 'application/x-tar',
    'tar.gz': 'application/gzip',
    tgz: 'application/gzip',
    gz: 'application/gzip',
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    csv: 'text/csv',
    md: 'text/markdown',
  };

  return contentTypeMap[ext || ''] || 'application/octet-stream';
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Validate filename for security
 */
export function validateFilename(filename: string): boolean {
  // Prevent path traversal and dangerous characters
  const dangerous = /[<>:"|?*\\/\x00-\x1f]/g;
  const pathTraversal = /\.\./g;

  return !dangerous.test(filename) && !pathTraversal.test(filename) && filename.length <= 255;
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"|?*\\/\x00-\x1f]/g, '_')
    .replace(/\.\./g, '_')
    .substring(0, 255);
}
