import { Injectable, Logger } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env, ROOT_DIR } from '../config/env';

export interface StoredFile {
  body: Readable;
  mime?: string;
  size?: number;
}

/**
 * Private file storage for KYC documents (ARCHITECTURE §09: private bucket, random keys, never public).
 * STORAGE_DRIVER=s3 talks to Cloudflare R2 / any S3 endpoint; STORAGE_DRIVER=local writes under infra/data (git-ignored) for dev.
 * Files are always served through the API with an auth check, never by URL.
 */
@Injectable()
export class StorageService {
  private readonly log = new Logger('Storage');
  private readonly s3 =
    env.STORAGE_DRIVER === 's3'
      ? new S3Client({
          region: 'auto',
          endpoint: env.R2_ENDPOINT || (env.R2_ACCOUNT_ID ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined),
          credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
        })
      : null;
  private readonly dir = resolve(ROOT_DIR, env.STORAGE_LOCAL_DIR);

  constructor() {
    this.log.log(`driver=${env.STORAGE_DRIVER}${this.s3 ? ` bucket=${env.R2_BUCKET}` : ` dir=${this.dir}`}`);
  }

  private localPath(key: string) {
    const p = resolve(this.dir, key);
    if (!p.startsWith(this.dir + sep)) throw new Error('storage key escapes the upload directory');
    return p;
  }

  async put(key: string, body: Buffer, mime: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, Body: body, ContentType: mime }));
      return;
    }
    const p = this.localPath(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body, { mode: 0o600 });
  }

  async get(key: string): Promise<StoredFile> {
    if (this.s3) {
      const r = await this.s3.send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
      return { body: r.Body as Readable, mime: r.ContentType, size: r.ContentLength };
    }
    const p = this.localPath(key);
    const st = await stat(p);
    return { body: createReadStream(p), size: st.size };
  }

  async remove(key: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
      return;
    }
    await unlink(this.localPath(key)).catch(() => undefined);
  }
}
