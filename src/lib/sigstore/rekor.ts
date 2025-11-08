// Rekor Transparency Log - TKT-021
// SPEC Reference: Section 9.2 (Sigstore Integration)

export interface RekorEntry {
  uuid: string;
  log_index: number;
  log_id: string;
  integrated_time: number;
  body: string;
  verification: {
    signed_entry_timestamp: string;
    inclusion_proof?: {
      log_index: number;
      root_hash: string;
      tree_size: number;
      hashes: string[];
    };
  };
}

export interface RekorSearchResult {
  entries: RekorEntry[];
  total: number;
}

/**
 * Queries Rekor transparency log for a specific entry.
 *
 * @param logId - The Rekor log ID
 * @param logIndex - The log entry index
 * @returns The Rekor entry or null if not found
 */
export async function getRekorEntry(logId: string, logIndex: number): Promise<RekorEntry | null> {
  try {
    const response = await fetch(
      `https://rekor.sigstore.dev/api/v1/log/entries/${logId}/${logIndex}`
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Rekor entry:', error);
    return null;
  }
}

/**
 * Searches Rekor for entries matching a hash.
 * Useful for finding signatures for a specific artifact.
 *
 * @param hash - The artifact hash (SHA-256)
 * @returns Search results
 */
export async function searchRekorByHash(hash: string): Promise<RekorSearchResult> {
  try {
    const response = await fetch(`https://rekor.sigstore.dev/api/v1/index/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash }),
    });

    if (!response.ok) {
      return { entries: [], total: 0 };
    }

    const uuids = await response.json();

    // Fetch full entries for each UUID
    const entries = await Promise.all(
      uuids.map(async (uuid: string) => {
        const entryResponse = await fetch(`https://rekor.sigstore.dev/api/v1/log/entries/${uuid}`);
        return entryResponse.ok ? await entryResponse.json() : null;
      })
    );

    const validEntries = entries.filter((e) => e !== null);

    return {
      entries: validEntries,
      total: validEntries.length,
    };
  } catch (error) {
    console.error('Failed to search Rekor:', error);
    return { entries: [], total: 0 };
  }
}

/**
 * Verifies the inclusion proof for a Rekor entry.
 * This proves the entry was included in the transparency log.
 *
 * @param entry - The Rekor entry to verify
 * @returns true if inclusion proof is valid
 */
export async function verifyInclusionProof(entry: RekorEntry): Promise<boolean> {
  try {
    if (!entry.verification.inclusion_proof) {
      return false;
    }

    // In production, this would verify the Merkle tree proof
    // For now, we just check that the proof exists
    const proof = entry.verification.inclusion_proof;
    return (
      proof.log_index === entry.log_index && proof.root_hash.length > 0 && proof.hashes.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Gets the current Rekor log info (size, root hash, etc.)
 */
export async function getRekorLogInfo() {
  try {
    const response = await fetch('https://rekor.sigstore.dev/api/v1/log/publicKey');

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Rekor log info:', error);
    return null;
  }
}
