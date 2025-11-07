# Sigstore Integration

Supply chain security for Spell packages using Sigstore (Fulcio + Rekor).

## Overview

This module provides keyless code signing for Spell packages using:
- **Fulcio**: Short-lived certificate authority (15 min certificates)
- **Rekor**: Immutable transparency log
- **Cosign**: Signing tool (CLI-based)

## Architecture

### Maker Side (Signing)
```
GitHub Actions → OIDC Token → Fulcio → Certificate
                                     ↓
Spell Package → Cosign → Signature + Rekor Entry
```

### Platform Side (Verification)
```
Uploaded Package → Verify Signature → Verify Rekor → Store Metadata
```

## Usage

### For Makers

1. Copy the workflow template from `docs/spell-publish-workflow.yml`
2. Add to your repo at `.github/workflows/publish.yml`
3. Set `SPELL_API_KEY` secret in repository settings
4. Push a version tag: `git tag v1.0.0 && git push --tags`

### For Platform

```typescript
import { verifySpellSignature } from '@/lib/sigstore';

const result = await verifySpellSignature(tarBytes, signatureBundle);

if (result.verified) {
  await prisma.spell.update({
    where: { key: spellKey },
    data: {
      signatureUrl: signatureBundle.signature_url,
      signatureVerified: true,
      signedBy: result.signed_by,
      signedAt: result.signed_at,
      rekorIndex: result.rekor_index,
    },
  });
}
```

## API Reference

### `signSpellPackage(tarPath, outputPath)`

Signs a spell package tarball.

**Parameters:**
- `tarPath` - Path to tarball
- `outputPath` - Where to write signature bundle

**Returns:** `SignatureBundle`

### `verifySpellSignature(tarBytes, signatureBundle)`

Verifies a signed spell package.

**Parameters:**
- `tarBytes` - Package bytes
- `signatureBundle` - Signature bundle JSON

**Returns:** `VerificationResult`

### Rekor Functions

- `getRekorEntry(logId, logIndex)` - Fetch entry from transparency log
- `searchRekorByHash(hash)` - Find entries by artifact hash
- `verifyInclusionProof(entry)` - Verify Merkle tree proof

## Security Properties

1. **Keyless Signing**: No long-lived private keys to manage
2. **Identity-Based**: GitHub identity in certificate
3. **Transparency**: All signatures in public log
4. **Timestamping**: RFC 3161 timestamps from Rekor
5. **Non-Repudiation**: Signatures cannot be denied

## Certificate Format

```
Subject: CN=https://github.com/{owner}/{repo}/.github/workflows/{workflow}.yml@refs/...
Issuer: CN=sigstore-intermediate,O=sigstore.dev
Valid: 15 minutes
```

## Migration Path

- **Phase 1**: Warning on unsigned packages (current)
- **Phase 2**: Require signatures for new packages
- **Phase 3**: Reject all unsigned packages

## Testing

```bash
# Run tests
pnpm test src/lib/sigstore

# Test with real Sigstore (requires cosign)
INTEGRATION_TESTS=true pnpm test src/lib/sigstore
```

## Dependencies

- `cosign` CLI (installed in CI)
- Node.js `child_process` for CLI execution
- Rekor public API (https://rekor.sigstore.dev)

## References

- [Sigstore Documentation](https://docs.sigstore.dev)
- [Fulcio Certificate Authority](https://github.com/sigstore/fulcio)
- [Rekor Transparency Log](https://github.com/sigstore/rekor)
- [Cosign CLI](https://github.com/sigstore/cosign)
