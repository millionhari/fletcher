import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { REPO_ROOT } from "@fletcher/db";

export interface StoredFile {
  storageKey: string;
  bytes: number;
}

export interface StorageAdapter {
  put(input: { data: Buffer; fileName: string; folder: string }): Promise<StoredFile>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  /** Public URL the web app serves the file from. */
  publicUrl(storageKey: string): string;
}

export function uploadRoot(): string {
  return process.env.UPLOAD_DIR ? path.resolve(REPO_ROOT, process.env.UPLOAD_DIR) : path.join(REPO_ROOT, ".uploads");
}

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 80) || "file";
}

export class LocalDiskStorage implements StorageAdapter {
  constructor(private root = uploadRoot()) {}

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root)) throw new Error("Invalid storage key");
    return full;
  }

  async put({ data, fileName, folder }: { data: Buffer; fileName: string; folder: string }): Promise<StoredFile> {
    const key = path.posix.join(folder, `${randomUUID()}-${safeName(fileName)}`);
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return { storageKey: key, bytes: data.byteLength };
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
}

export const storage: StorageAdapter = new LocalDiskStorage();
