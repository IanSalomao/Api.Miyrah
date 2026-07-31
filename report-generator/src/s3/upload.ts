import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AppConfig } from '../config';

let cachedClient: S3Client | null = null;

function s3Client(config: AppConfig): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: config.awsRegion,
    ...(config.s3Endpoint && { endpoint: config.s3Endpoint }),
    forcePathStyle: config.forcePathStyle,
    // Em dev, credenciais do MinIO; na Lambda, omitidas → IAM role da função.
    ...(config.s3AccessKey &&
      config.s3SecretKey && {
        credentials: {
          accessKeyId: config.s3AccessKey,
          secretAccessKey: config.s3SecretKey,
        },
      }),
  });
  return cachedClient;
}

/**
 * Sobe o PDF (privado) e devolve a `key`. A API nunca recebe os bytes — só a
 * chave interna, da qual gera URLs assinadas sob demanda.
 */
export async function uploadPdf(
  pdf: Buffer,
  churchId: string,
  config: AppConfig,
): Promise<string> {
  const key = `reports/${churchId}/${randomUUID()}.pdf`;
  await s3Client(config).send(
    new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
      Body: pdf,
      ContentType: 'application/pdf',
    }),
  );
  return key;
}
