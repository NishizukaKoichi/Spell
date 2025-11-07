// Sigstore Verification - TKT-021
// SPEC Reference: Section 9.2 (Sigstore Integration)

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { createHash } from 'crypto';

export interface VerificationResult {
  verified: boolean;
  signed_by: string;
  signed_at: Date;
  rekor_index: number;
  rekor_verified: boolean;
  errors?: string[];
}

/**
 * Verifies a Spell package signature using Sigstore.
 * This runs on the Platform side when a Spell is uploaded.
 * 
 * @param tarBytes - The tarball bytes to verify
 * @param signatureBundle - The Sigstore signature bundle
 * @returns Verification result with metadata
 */
export async function verifySpellSignature(
  tarBytes: Buffer,
  signatureBundle: any
): Promise<VerificationResult> {
  const errors: string[] = [];

  // Temporary files for verification
  const tempTar = `/tmp/spell-verify-${Date.now()}.tar`;
  const tempSig = `/tmp/spell-signature-${Date.now()}.json`;

  try {
    // Write temporary files
    writeFileSync(tempTar, tarBytes);
    writeFileSync(tempSig, JSON.stringify(signatureBundle));

    // 1. Verify signature using cosign
    try {
      execSync(`cosign verify-blob ${tempTar} --bundle ${tempSig}`, {
        stdio: 'pipe',
      });
    } catch (e) {
      errors.push('Signature verification failed');
      return {
        verified: false,
        signed_by: 'unknown',
        signed_at: new Date(0),
        rekor_index: 0,
        rekor_verified: false,
        errors,
      };
    }

    // 2. Verify Rekor entry
    const rekorVerified = await verifyRekorEntry(
      signatureBundle.rekorBundle?.Payload
    );

    if (!rekorVerified) {
      errors.push('Rekor entry verification failed');
    }

    // 3. Extract metadata
    const signedBy = extractIdentity(signatureBundle.cert || '');
    const signedAt = new Date(
      (signatureBundle.rekorBundle?.Payload?.integratedTime || 0) * 1000
    );
    const rekorIndex = signatureBundle.rekorBundle?.Payload?.logIndex || 0;

    return {
      verified: errors.length === 0,
      signed_by: signedBy,
      signed_at: signedAt,
      rekor_index: rekorIndex,
      rekor_verified: rekorVerified,
      errors: errors.length > 0 ? errors : undefined,
    };
  } finally {
    // Cleanup temporary files
    try {
      unlinkSync(tempTar);
      unlinkSync(tempSig);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Verifies a Rekor transparency log entry.
 * Queries the public Rekor instance and validates the entry.
 */
async function verifyRekorEntry(rekorPayload: any): Promise<boolean> {
  if (!rekorPayload?.logID || !rekorPayload?.logIndex) {
    return false;
  }

  try {
    // Query Rekor public log
    const response = await fetch(
      `https://rekor.sigstore.dev/api/v1/log/entries/${rekorPayload.logID}/${rekorPayload.logIndex}`
    );

    if (!response.ok) {
      return false;
    }

    const entry = await response.json();

    // Verify entry matches our payload
    const entryHash = createHash('sha256')
      .update(JSON.stringify(entry))
      .digest('hex');

    return entryHash === rekorPayload.bodyHash;
  } catch {
    return false;
  }
}

/**
 * Extracts GitHub identity from Fulcio certificate.
 */
function extractIdentity(cert: string): string {
  try {
    const match = cert.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    return match ? `${match[1]}/${match[2]}` : 'unknown';
  } catch {
    return 'unknown';
  }
}
