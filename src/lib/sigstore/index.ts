// Sigstore Module Export - TKT-021
// SPEC Reference: Section 9.2 (Sigstore Integration)

export { signSpellPackage } from './sign';
export type { SignatureBundle } from './sign';

export { verifySpellSignature } from './verify';
export type { VerificationResult } from './verify';

export {
  getRekorEntry,
  searchRekorByHash,
  verifyInclusionProof,
  getRekorLogInfo,
} from './rekor';
export type { RekorEntry, RekorSearchResult } from './rekor';
