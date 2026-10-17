import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Artifact } from '../../../packages/contracts/mission.ts';
import { config } from '../config.ts';

/**
 * Content-Addressed Artifact Store (SHA-256)
 * Invariant I6: No artifact is mutated; edits create new hashes with lineage DAG.
 */
class ContentAddressedArtifactStore {
  private blobDir: string;
  private artifactsMetaFile: string;
  private metadataMap: Map<string, Artifact> = new Map();

  constructor() {
    const baseDir = path.resolve(process.cwd(), config.STORAGE_DIR);
    this.blobDir = path.join(baseDir, 'blobs');
    this.artifactsMetaFile = path.join(baseDir, 'artifacts.json');

    if (!fs.existsSync(this.blobDir)) {
      fs.mkdirSync(this.blobDir, { recursive: true });
    }

    this.loadMetadata();
  }

  private loadMetadata() {
    try {
      if (fs.existsSync(this.artifactsMetaFile)) {
        const list = JSON.parse(fs.readFileSync(this.artifactsMetaFile, 'utf-8'));
        for (const item of list) {
          this.metadataMap.set(item.hash, item);
        }
      }
    } catch (err) {
      console.warn('[ArtifactStore] Failed to load metadata, initializing empty:', err);
    }
  }

  private persistMetadata() {
    try {
      const arr = Array.from(this.metadataMap.values());
      fs.writeFileSync(this.artifactsMetaFile, JSON.stringify(arr, null, 2));
    } catch (err) {
      console.error('[ArtifactStore] Error saving metadata:', err);
    }
  }

  /**
   * Put content into the store.
   * Calculates SHA-256, writes blob if not present, and registers metadata with lineage.
   */
  public put(
    name: string,
    content: string,
    mime: string = 'text/plain',
    producerStep: string = 'system',
    parentHashes: string[] = []
  ): Artifact {
    const hash = crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
    const blobPath = path.join(this.blobDir, hash);

    if (!fs.existsSync(blobPath)) {
      fs.writeFileSync(blobPath, content, 'utf-8');
    }

    const artifact: Artifact = {
      hash,
      name,
      size: Buffer.byteLength(content, 'utf-8'),
      mime,
      producer_step: producerStep,
      lineage: parentHashes,
      content,
      created_at: Date.now(),
    };

    this.metadataMap.set(hash, artifact);
    this.persistMetadata();
    return artifact;
  }

  public get(hash: string): Artifact | null {
    const meta = this.metadataMap.get(hash);
    if (!meta) return null;

    if (!meta.content) {
      const blobPath = path.join(this.blobDir, hash);
      if (fs.existsSync(blobPath)) {
        meta.content = fs.readFileSync(blobPath, 'utf-8');
      }
    }
    return meta;
  }

  public has(hash: string): boolean {
    return this.metadataMap.has(hash);
  }

  public list(): Artifact[] {
    return Array.from(this.metadataMap.values()).sort((a, b) => b.created_at - a.created_at);
  }
}

export const ArtifactStore = new ContentAddressedArtifactStore();
