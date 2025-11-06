# Cloudflare R2 Artifact Storage Setup

This document provides comprehensive instructions for setting up and using Cloudflare R2 for artifact storage in the Spell platform.

## Overview

The Spell platform now uses Cloudflare R2 (S3-compatible object storage) for persistent artifact storage instead of relying solely on GitHub Actions artifacts. This provides:

- **Reliability**: Artifacts persist beyond GitHub's expiration limits
- **Access Control**: Fine-grained permissions and signed URLs
- **Cost Efficiency**: Cloudflare R2 offers free egress
- **Audit Logging**: Complete tracking of artifact operations
- **Budget Tracking**: Storage costs integrated into budget system

## Architecture

### Storage Structure

```
spell-artifacts/
  └── casts/
      └── {castId}/
          ├── output.json
          ├── logs.txt
          └── result.zip
```

### Data Flow

1. **Workflow Completion**: GitHub Actions workflow completes
2. **Webhook Trigger**: GitHub sends webhook to `/api/webhooks/github`
3. **Artifact Download**: System downloads artifact from GitHub
4. **R2 Upload**: Artifact is uploaded to R2 with metadata
5. **Database Update**: Cast record updated with R2 storage key
6. **Audit Log**: Upload event logged for compliance

### Access Flow

1. **User Request**: User requests artifact download
2. **Authorization**: System verifies user permissions
3. **Signed URL**: Generate time-limited signed URL (1 hour)
4. **Redirect**: User redirected to signed R2 URL
5. **Audit Log**: Download event logged

## Setup Instructions

### 1. Create Cloudflare R2 Bucket

1. Log in to Cloudflare Dashboard
2. Navigate to R2 Object Storage
3. Create a new bucket named `spell-artifacts`
4. Note your Account ID

### 2. Generate API Tokens

1. In R2 settings, click "Manage R2 API Tokens"
2. Create a new API token with permissions:
   - Object Read
   - Object Write
   - Object Delete
3. Save the Access Key ID and Secret Access Key

### 3. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Cloudflare R2 Storage
R2_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_access_key_here
R2_SECRET_ACCESS_KEY=your_secret_key_here
R2_BUCKET_NAME=spell-artifacts
R2_PUBLIC_URL=https://artifacts.yourdomain.com  # Optional: Custom domain
```

### 4. Run Database Migration

Generate and run the Prisma migration:

```bash
npx prisma migrate dev --name add_artifact_storage_fields
```

This adds the following fields to the Cast model:
- `artifactStorageKey` - R2 object key
- `artifactSize` - Size in bytes
- `artifactContentType` - MIME type

### 5. Migrate Existing Artifacts

If you have existing artifacts stored as GitHub URLs, run the migration script:

```bash
# Dry run to see what would be migrated
tsx scripts/migrate-artifacts-to-r2.ts --dry-run

# Perform actual migration
tsx scripts/migrate-artifacts-to-r2.ts --batch-size=10 --limit=100

# Migrate all artifacts
tsx scripts/migrate-artifacts-to-r2.ts
```

### 6. Verify Setup

Test artifact storage with a test cast:

```bash
# Upload test artifact
curl -X POST http://localhost:3000/api/casts/{castId}/artifacts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.zip"

# Download test artifact
curl http://localhost:3000/api/artifacts/{castId}/test.zip \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -L -o downloaded.zip
```

## API Endpoints

### Download Artifact

**GET** `/api/artifacts/{castId}/{filename}`

Download an artifact for a specific cast.

**Authentication**: Required
**Authorization**: Cast owner OR spell is public

**Response**: 302 Redirect to signed R2 URL

**Example**:
```bash
curl -L http://localhost:3000/api/artifacts/cast_123/output.zip \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o output.zip
```

### List User's Artifacts

**GET** `/api/artifacts`

List all artifacts owned by the authenticated user.

**Query Parameters**:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

**Example**:
```bash
curl http://localhost:3000/api/artifacts?page=1&limit=20 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "artifacts": [
    {
      "castId": "cast_123",
      "spellName": "Data Processor",
      "status": "succeeded",
      "artifactUrl": "/api/artifacts/cast_123/output.zip",
      "size": 1048576,
      "sizeFormatted": "1 MB",
      "contentType": "application/zip",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 45,
    "totalPages": 3
  },
  "storage": {
    "totalBytes": 52428800,
    "totalFormatted": "50 MB"
  }
}
```

### Delete Artifacts

**DELETE** `/api/artifacts`

Delete artifacts for specified casts.

**Body**:
```json
{
  "castIds": ["cast_123", "cast_456"]
}
```

**Example**:
```bash
curl -X DELETE http://localhost:3000/api/artifacts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"castIds": ["cast_123", "cast_456"]}'
```

## Lifecycle Management

### Automatic Cleanup

Use the cleanup utilities to manage storage:

```typescript
import { cleanupOldArtifacts, cleanupFailedCasts } from '@/lib/artifact-cleanup';

// Clean up artifacts older than 90 days
const result = await cleanupOldArtifacts(90, { dryRun: false });

// Clean up failed cast artifacts older than 7 days
const failedResult = await cleanupFailedCasts(7, { dryRun: false });
```

### Storage Analytics

Get storage usage analytics:

```typescript
import {
  getStorageUsageByUser,
  getTotalStorageUsage,
  estimateStorageCosts,
} from '@/lib/artifact-cleanup';

// Top 10 users by storage
const topUsers = await getStorageUsageByUser(10);

// Total platform storage
const total = await getTotalStorageUsage();

// Estimate costs
const costs = estimateStorageCosts(
  total.totalBytes,
  10000, // monthly writes
  100000  // monthly reads
);
```

### Cron Jobs

Set up scheduled cleanup jobs:

```typescript
// In your cron job handler
import { cleanupOldArtifacts } from '@/lib/artifact-cleanup';

export async function dailyCleanup() {
  // Clean up artifacts older than 90 days
  await cleanupOldArtifacts(90);

  // Clean up failed casts older than 7 days
  await cleanupFailedCasts(7);
}
```

## Security

### Access Control

Artifacts are protected by:

1. **Authentication**: JWT or session-based authentication required
2. **Authorization**:
   - Cast owner has full access
   - Spell author has read access
   - Public spells allow public read access
3. **Signed URLs**: Time-limited (1 hour) signed URLs prevent direct access
4. **Audit Logging**: All access attempts logged

### Filename Validation

All filenames are validated to prevent:
- Path traversal attacks (`../`, `..\\`)
- Dangerous characters (`<`, `>`, `|`, `"`, etc.)
- Null byte injection (`\x00`)
- Excessively long names (>255 characters)

### Rate Limiting

Consider implementing rate limiting on artifact downloads:

```typescript
// In your middleware
import { rateLimit } from '@/lib/rate-limit';

export const artifactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each user to 100 downloads per window
});
```

## Monitoring

### Audit Events

The following events are logged:

- `artifact.uploaded` - Artifact uploaded to R2
- `artifact.downloaded` - Artifact downloaded by user
- `artifact.deleted` - Artifact deleted from R2
- `artifact.access_denied` - Unauthorized access attempt

Query audit logs:

```sql
SELECT * FROM audit_logs
WHERE action LIKE 'artifact.%'
ORDER BY created_at DESC
LIMIT 100;
```

### Storage Metrics

Track storage metrics in your monitoring system:

```typescript
// Prometheus-style metrics
storage_bytes_total{user_id="user_123"} 52428800
storage_artifacts_total{user_id="user_123"} 42
storage_costs_monthly_usd 0.78
```

## Cost Management

### Cloudflare R2 Pricing (2024)

- **Storage**: $0.015 per GB-month
- **Class A Operations** (writes): $4.50 per million
- **Class B Operations** (reads): $0.36 per million
- **Egress**: FREE (no bandwidth charges)

### Example Costs

For 100GB storage with 10,000 monthly writes and 100,000 monthly reads:

```typescript
const costs = estimateStorageCosts(
  100 * 1024 * 1024 * 1024, // 100GB in bytes
  10000,   // writes
  100000   // reads
);

// Result:
// {
//   storageCostPerMonth: 1.50,  // $1.50 for storage
//   writeCostPerMonth: 0.045,   // $0.045 for writes
//   readCostPerMonth: 0.036,    // $0.036 for reads
//   totalCostPerMonth: 1.581,   // $1.58 total
//   storageGB: 100
// }
```

### Budget Integration

Storage costs are tracked in the budget system:

```typescript
import { updateBudgetSpend } from '@/lib/budget';

// Track storage costs monthly
await updateBudgetSpend(userId, storageCostCents);
```

## Troubleshooting

### Common Issues

#### 1. "Missing R2_ACCOUNT_ID" Error

**Solution**: Ensure all R2 environment variables are set in `.env`

```bash
# Check environment variables
echo $R2_ACCOUNT_ID
echo $R2_ACCESS_KEY_ID
echo $R2_SECRET_ACCESS_KEY
echo $R2_BUCKET_NAME
```

#### 2. "Access Denied" on Upload

**Solution**: Verify R2 API token has write permissions

1. Check API token permissions in Cloudflare dashboard
2. Regenerate token if necessary
3. Update `.env` with new credentials

#### 3. Signed URLs Not Working

**Solution**: Check endpoint configuration

```typescript
// Verify R2 endpoint is correct
const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
```

#### 4. Artifacts Not Appearing in R2

**Solution**: Check webhook is firing correctly

```bash
# Check webhook logs
tail -f logs/webhook.log | grep "GitHub Webhook"

# Test webhook manually
curl -X POST http://localhost:3000/api/webhooks/github \
  -H "X-GitHub-Event: workflow_run" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d @test-payload.json
```

### Debug Mode

Enable debug logging:

```typescript
// In storage.ts
console.log('[R2] Uploading:', { castId, filename, size: content.length });
console.log('[R2] Upload complete:', { key, size });
```

## Testing

### Unit Tests

Run storage utility tests:

```bash
npm test tests/lib/storage.test.ts
```

### Integration Tests

Integration tests require R2 credentials:

```bash
# Set test credentials
export R2_ACCOUNT_ID=test_account
export R2_ACCESS_KEY_ID=test_key
export R2_SECRET_ACCESS_KEY=test_secret
export R2_BUCKET_NAME=spell-artifacts-test

# Run integration tests
npm test tests/integration/storage.test.ts
```

### Manual Testing

1. Create a test cast
2. Upload an artifact manually
3. Download via API
4. Verify in R2 console
5. Delete and verify removal

## Best Practices

### 1. Use Signed URLs

Always use signed URLs for artifact access:

```typescript
// Good
const signedUrl = await getArtifactUrl({ castId, filename, expiresIn: 3600 });
res.redirect(signedUrl);

// Bad - direct R2 URLs
res.json({ url: `https://r2.../casts/${castId}/${filename}` });
```

### 2. Validate Filenames

Always validate and sanitize filenames:

```typescript
import { validateFilename, sanitizeFilename } from '@/lib/storage';

if (!validateFilename(filename)) {
  throw new Error('Invalid filename');
}

const safe = sanitizeFilename(userProvidedName);
```

### 3. Set Appropriate TTLs

Use appropriate expiration times for signed URLs:

```typescript
// Download links: 1 hour
const downloadUrl = await getArtifactUrl({ castId, filename, expiresIn: 3600 });

// Temporary share links: 15 minutes
const shareUrl = await getArtifactUrl({ castId, filename, expiresIn: 900 });
```

### 4. Implement Cleanup

Run regular cleanup to manage costs:

```typescript
// Daily cleanup job
async function dailyMaintenance() {
  await cleanupOldArtifacts(90);      // Delete artifacts > 90 days
  await cleanupFailedCasts(7);        // Delete failed casts > 7 days
}
```

### 5. Monitor Storage Usage

Track storage metrics:

```typescript
// Weekly storage report
async function weeklyReport() {
  const total = await getTotalStorageUsage();
  const topUsers = await getStorageUsageByUser(10);

  console.log(`Total storage: ${total.totalFormatted}`);
  console.log(`Top users:`, topUsers);
}
```

## Migration Guide

### From GitHub Artifacts to R2

1. **Prepare**: Ensure R2 is configured and tested
2. **Test**: Run migration script in dry-run mode
3. **Migrate**: Execute migration in batches
4. **Verify**: Check artifacts are accessible
5. **Clean up**: Remove old GitHub artifacts (optional)

```bash
# Step 1: Dry run
tsx scripts/migrate-artifacts-to-r2.ts --dry-run

# Step 2: Small batch test
tsx scripts/migrate-artifacts-to-r2.ts --limit=10

# Step 3: Full migration
tsx scripts/migrate-artifacts-to-r2.ts --batch-size=50
```

## Support

For issues or questions:

1. Check this documentation
2. Review troubleshooting section
3. Check audit logs for errors
4. Open an issue on GitHub

## References

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [AWS S3 SDK for JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)
- [S3-Compatible Storage](https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html)
