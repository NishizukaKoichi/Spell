// Sigstore Signing - TKT-021
// SPEC Reference: Section 9.2 (Sigstore Integration)

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

export interface SignatureBundle {
  signature_url: string;
  rekor_index: number;
  rekor_uuid: string;
  cert_identity: string;
}

/**
 * Signs a Spell package tarball using Sigstore cosign.
 * This function is intended to run in GitHub Actions during the Maker's CI/CD.
 * 
 * @param tarPath - Path to the tarball to sign
 * @param outputPath - Path where signature bundle will be written
 * @returns Signature metadata
 */
export async function signSpellPackage(
  tarPath: string,
  outputPath: string
): Promise<SignatureBundle> {
  // Use cosign CLI for signing
  // In production, this runs in GitHub Actions with OIDC token
  const cmd = `cosign sign-blob ${tarPath} \
    --bundle ${outputPath} \
    --oidc-issuer=https://github.com/login/oauth \
    --yes`;

  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (error) {
    throw new Error(
      `Failed to sign spell package: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Read the generated bundle
  const bundle = JSON.parse(readFileSync(outputPath, 'utf-8'));

  return {
    signature_url: outputPath,
    rekor_index: bundle.rekorBundle?.Payload?.logIndex || 0,
    rekor_uuid: bundle.rekorBundle?.Payload?.logID || '',
    cert_identity: extractIdentity(bundle.cert || ''),
  };
}

/**
 * Extracts GitHub identity from Fulcio certificate.
 * Format: https://github.com/{owner}/{repo}/.github/workflows/{workflow}.yml@refs/...
 */
function extractIdentity(cert: string): string {
  try {
    const match = cert.match(/github\.com\/([^/]+)\/([^/]+)/);
    return match ? `${match[1]}/${match[2]}` : 'unknown';
  } catch {
    return 'unknown';
  }
}
