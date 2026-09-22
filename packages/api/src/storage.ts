import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Upload } from "tus-js-client";
import { REPO_ROOT } from "@fletcher/db";

export interface StoredFile {
  storageKey: string;
  bytes: number;
}

export interface StorageAdapter {
  readonly driver: "local" | "supabase";
  put(input: { data: Buffer; fileName: string; folder: string; mimeType?: string }): Promise<StoredFile>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  /** Stable URL the web app serves the file from; the route behind it checks the session. */
  publicUrl(storageKey: string): string;
  /** Short-lived direct URL for the object, or null when the driver has none (local). */
  signedReadUrl(storageKey: string, ttlSeconds: number): Promise<string | null>;
  /** A URL the browser can PUT to directly, or null when uploads go through /api/upload. */
  createSignedUploadUrl(storageKey: string): Promise<{ url: string; token: string } | null>;
  /** Size + type of a stored object, or null if it isn't there. */
  head(storageKey: string): Promise<{ bytes: number; mimeType: string | null } | null>;
  /** Stream a large object in (imports). `size` may be unknown for chunked sources. */
  putStream(input: { storageKey: string; stream: Readable; mimeType: string; size: number | null; onProgress?: (bytes: number) => void }): Promise<void>;
}

export function uploadRoot(): string {
  return process.env.UPLOAD_DIR ? path.resolve(REPO_ROOT, process.env.UPLOAD_DIR) : path.join(REPO_ROOT, ".uploads");
}

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 80) || "file";
}

/** Keys are namespaced by workspace so a listing or a bucket policy can scope to one. */
export function newStorageKey(folder: string, fileName: string): string {
  const clean = folder.replace(/[^a-z0-9/_-]/gi, "").replace(/^\/+|\/+$/g, "") || "uploads";
  return path.posix.join(clean, `${randomUUID()}-${safeName(fileName)}`);
}

export class LocalDiskStorage implements StorageAdapter {
  readonly driver = "local" as const;
  constructor(private root = uploadRoot()) {}

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root)) throw new Error("Invalid storage key");
    return full;
  }

  async put({ data, fileName, folder }: { data: Buffer; fileName: string; folder: string }): Promise<StoredFile> {
    const key = newStorageKey(folder, fileName);
    await this.write(key, data);
    return { storageKey: key, bytes: data.byteLength };
  }

  /** Write to a key chosen by the caller (the upload route, after a reservation). */
  async write(storageKey: string, data: Buffer): Promise<void> {
    const full = this.resolve(storageKey);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async read(storageKey: string): Promise<Buffer> {
    return fs.readFile(this.resolve(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await fs.rm(this.resolve(storageKey), { force: true });
  }

  publicUrl(storageKey: string): string {
    return `/api/files/${storageKey}`;
  }

  async signedReadUrl(): Promise<string | null> {
    return null;
  }

  async createSignedUploadUrl(): Promise<null> {
    return null;
  }

  async head(storageKey: string) {
    try {
      const st = await fs.stat(this.resolve(storageKey));
      return { bytes: st.size, mimeType: null };
    } catch {
      return null;
    }
  }

  async putStream({ storageKey, stream, onProgress }: { storageKey: string; stream: Readable; onProgress?: (bytes: number) => void }): Promise<void> {
    const full = this.resolve(storageKey);
    await fs.mkdir(path.dirname(full), { recursive: true });
    let seen = 0;
    stream.on("data", (chunk: Buffer) => { seen += chunk.length; onProgress?.(seen); });
    await pipeline(stream, createWriteStream(full));
  }
}

/**
 * Supabase Storage, private bucket, every call with the service role. The
 * browser never sees the key: uploads go through signed upload URLs and reads
 * through /api/files → signed read URLs.
 */
export class SupabaseStorage implements StorageAdapter {
  readonly driver = "supabase" as const;
  private client: SupabaseClient;
  constructor(private url: string, private serviceKey: string, private bucket: string) {
    this.client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private get store() {
    return this.client.storage.from(this.bucket);
  }

  async put({ data, fileName, folder, mimeType }: { data: Buffer; fileName: string; folder: string; mimeType?: string }): Promise<StoredFile> {
    const key = newStorageKey(folder, fileName);
    const { error } = await this.store.upload(key, data, { contentType: mimeType ?? "application/octet-stream", upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return { storageKey: key, bytes: data.byteLength };
  }

  async read(storageKey: string): Promise<Buffer> {
    const { data, error } = await this.store.download(storageKey);
    if (error || !data) throw new Error(`Storage read failed: ${error?.message ?? "no data"}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async delete(storageKey: string): Promise<void> {
    const { error } = await this.store.remove([storageKey]);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  }

  publicUrl(storageKey: string): string {
    return `/api/files/${storageKey}`;
  }

  async signedReadUrl(storageKey: string, ttlSeconds: number): Promise<string | null> {
    const { data, error } = await this.store.createSignedUrl(storageKey, ttlSeconds);
    if (error || !data) return null;
    return data.signedUrl;
  }

  async createSignedUploadUrl(storageKey: string) {
    const { data, error } = await this.store.createSignedUploadUrl(storageKey);
    if (error || !data) throw new Error(`Could not start upload: ${error?.message ?? "unknown"}`);
    return { url: data.signedUrl, token: data.token };
  }

  async head(storageKey: string) {
    const dir = path.posix.dirname(storageKey);
    const name = path.posix.basename(storageKey);
    const { data, error } = await this.store.list(dir, { search: name, limit: 1 });
    if (error || !data?.length) return null;
    const obj = data.find((o) => o.name === name);
    if (!obj) return null;
    const meta = obj.metadata as { size?: number; mimetype?: string } | undefined;
    return { bytes: Number(meta?.size ?? 0), mimeType: meta?.mimetype ?? null };
  }

  /** Resumable (TUS) upload, 6 MB chunks — what Supabase recommends past a few MB, and it reports progress. */
  async putStream({ storageKey, stream, mimeType, size, onProgress }: { storageKey: string; stream: Readable; mimeType: string; size: number | null; onProgress?: (bytes: number) => void }): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const upload = new Upload(stream, {
        endpoint: `${this.url}/storage/v1/upload/resumable`,
        headers: { authorization: `Bearer ${this.serviceKey}`, "x-upsert": "false" },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024,
        metadata: { bucketName: this.bucket, objectName: storageKey, contentType: mimeType, cacheControl: "3600" },
        ...(size != null ? { uploadSize: size } : { uploadLengthDeferred: true }),
        onProgress: (sent) => onProgress?.(sent),
        onError: reject,
        onSuccess: () => resolve(),
      });
      upload.start();
    });
  }
}

function buildStorage(): StorageAdapter {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "supabase") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "fletcher-files";
    if (!url || !key) throw new Error("STORAGE_DRIVER=supabase needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    return new SupabaseStorage(url, key, bucket);
  }
  return new LocalDiskStorage();
}

// Built on first use, not at import: a build step or a route that never
// touches storage shouldn't need the storage secrets present.
let instance: StorageAdapter | null = null;
export const storage: StorageAdapter = new Proxy({} as StorageAdapter, {
  get(_t, prop) {
    if (!instance) instance = buildStorage();
    const v = (instance as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(instance) : v;
  },
});
