import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * S3-compatible object storage (MinIO on-prem, or real S3 — identical API).
 * Files are addressed by an object key, which is the `ref` stored in the DB.
 */
export class S3Storage {
  constructor() {
    const s = config.storage.s3;
    this.bucket = s.bucket;
    this.client = new S3Client({
      endpoint: s.endpoint,
      region: s.region,
      forcePathStyle: s.forcePathStyle,
      credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey },
    });
  }

  /** Create the bucket if it doesn't exist. */
  async ensureReady() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      logger.info({ bucket: this.bucket }, 'storage(s3): created bucket');
    }
  }

  /** @returns {Promise<{ref:string, size:number}>} */
  async put(key, buffer, contentType = 'application/octet-stream') {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return { ref: key, size: buffer.length };
  }

  /** @returns {Promise<Buffer>} */
  async get(ref) {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: ref }),
    );
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async remove(ref) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: ref }));
  }

  /** Time-limited download URL (no app proxying needed). */
  async presignedUrl(ref, expiresIn = 3600) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: ref }), {
      expiresIn,
    });
  }
}
