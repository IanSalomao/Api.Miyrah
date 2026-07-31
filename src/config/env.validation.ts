import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter no mínimo 16 caracteres'),
  JWT_EXPIRATION_DEFAULT: z.string().min(1),
  JWT_EXPIRATION_REMEMBER_ME: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  S3_ENDPOINT: z.url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  // Endpoint público do S3/MinIO para as URLs assinadas de download serem
  // abríveis pelo cliente (em dev, http://localhost:9000). Cai no S3_ENDPOINT.
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  // Relatórios: invocação da Lambda de render + TTL da URL de download.
  AWS_REGION: z.string().min(1).default('us-east-1'),
  LAMBDA_REPORT_FUNCTION_NAME: z
    .string()
    .min(1)
    .default('report-generator-dev-process'),
  // Em dev aponta para o serverless-offline; vazio em prod (SDK usa o endpoint real).
  LAMBDA_ENDPOINT: z.url().optional(),
  REPORT_DOWNLOAD_URL_TTL: z.coerce.number().int().positive().default(900),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_URL: z.url().default('http://localhost:5173'),
  // Default é o sender de sandbox do Resend, que funciona sem domínio verificado.
  MAIL_FROM: z.string().min(1).default('Miyrah <onboarding@resend.dev>'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n  ');
    throw new Error(`Variáveis de ambiente inválidas:\n  ${issues}`);
  }
  return result.data;
}
