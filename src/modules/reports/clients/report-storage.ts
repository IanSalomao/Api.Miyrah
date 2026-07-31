import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface SignedDownload {
  downloadUrl: string;
  expiresAt: string;
}

/** Abstração do storage. Token de injeção → mockável no e2e. */
export interface ReportStorage {
  getSignedDownloadUrl(key: string): Promise<SignedDownload>;
}

export const REPORT_STORAGE = Symbol('REPORT_STORAGE');

/**
 * Gera URLs de download assinadas e temporárias (TTL curto) sob demanda. O
 * `filePath` interno nunca é exposto ao cliente. Em dev, usa `S3_PUBLIC_ENDPOINT`
 * (ex.: http://localhost:9000) para que a URL assinada seja abrível no browser
 * do host — o `S3_ENDPOINT` interno (http://minio:9000) só resolve dentro da
 * rede do Docker.
 */
@Injectable()
export class S3ReportStorage implements ReportStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly ttlSeconds: number;

  constructor(config: ConfigService) {
    const endpoint =
      config.get<string>('S3_PUBLIC_ENDPOINT') ||
      config.getOrThrow<string>('S3_ENDPOINT');
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.ttlSeconds = Number(
      config.get<string>('REPORT_DOWNLOAD_URL_TTL') ?? 900,
    );
    this.client = new S3Client({
      region: config.getOrThrow<string>('AWS_REGION'),
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
  }

  async getSignedDownloadUrl(key: string): Promise<SignedDownload> {
    const downloadUrl = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: this.ttlSeconds },
    );
    const expiresAt = new Date(
      Date.now() + this.ttlSeconds * 1000,
    ).toISOString();
    return { downloadUrl, expiresAt };
  }
}
