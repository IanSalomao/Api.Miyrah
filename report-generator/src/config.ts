/**
 * Configuração lida do ambiente. Em dev (serverless-offline) as credenciais
 * vêm do `.env.local` (MinIO). Na Lambda real, deixe as credenciais vazias:
 * o SDK usa o IAM role da função (provider chain) e o endpoint padrão da AWS.
 */
export interface AppConfig {
  s3Endpoint?: string;
  s3Bucket: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  awsRegion: string;
  /** MinIO exige path-style; S3 real também aceita. Ligado quando há endpoint custom. */
  forcePathStyle: boolean;
  /** serverless-offline seta IS_OFFLINE=true; usamos o Chromium local nesse caso. */
  isOffline: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const s3Endpoint = process.env.S3_ENDPOINT || undefined;
  return {
    s3Endpoint,
    s3Bucket: requireEnv('S3_BUCKET'),
    s3AccessKey: process.env.S3_ACCESS_KEY || undefined,
    s3SecretKey: process.env.S3_SECRET_KEY || undefined,
    // AWS_REGION é injetada automaticamente pela Lambda; fallback para dev.
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    forcePathStyle: Boolean(s3Endpoint),
    isOffline:
      process.env.IS_OFFLINE === 'true' ||
      process.env.NODE_ENV === 'development',
  };
}
