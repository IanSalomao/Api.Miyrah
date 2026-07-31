import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvokeCommand,
  type InvokeCommandOutput,
  LambdaClient,
} from '@aws-sdk/client-lambda';
import { AppException } from '../../../common/exceptions/app.exception';
import type { ReportPayload } from '../report-payload';

export interface RenderedReport {
  key: string;
}

/** Abstração do renderizador (Lambda). Token de injeção → mockável no e2e. */
export interface ReportRenderer {
  render(payload: ReportPayload): Promise<RenderedReport>;
}

export const REPORT_RENDERER = Symbol('REPORT_RENDERER');

/**
 * Invoca a Lambda de render de forma síncrona (RequestResponse). Sem retry
 * (`maxAttempts: 1`) — um retry após timeout geraria um segundo PDF. Em dev,
 * `LAMBDA_ENDPOINT` aponta para o serverless-offline; em prod, o SDK usa o
 * endpoint padrão e o IAM role da API.
 *
 * Atenção (ver plano): se a API for exposta atrás de API Gateway REST, há teto
 * rígido de 29s na conexão — confirmar a topologia antes de assumir folga.
 */
@Injectable()
export class LambdaReportRenderer implements ReportRenderer {
  private readonly logger = new Logger(LambdaReportRenderer.name);
  private readonly client: LambdaClient;
  private readonly functionName: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('LAMBDA_ENDPOINT');
    this.functionName = config.getOrThrow<string>(
      'LAMBDA_REPORT_FUNCTION_NAME',
    );
    this.client = new LambdaClient({
      region: config.getOrThrow<string>('AWS_REGION'),
      maxAttempts: 1,
      ...(endpoint && {
        endpoint,
        // serverless-offline não valida credenciais; valores fictícios bastam.
        credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
      }),
    });
  }

  async render(payload: ReportPayload): Promise<RenderedReport> {
    let response: InvokeCommandOutput;
    try {
      response = await this.client.send(
        new InvokeCommand({
          FunctionName: this.functionName,
          InvocationType: 'RequestResponse',
          Payload: Buffer.from(JSON.stringify(payload)),
        }),
      );
    } catch (error) {
      this.logger.error(
        `Falha ao invocar a Lambda de relatório: ${this.describe(error)}`,
      );
      throw this.failure();
    }

    if (response.FunctionError) {
      const detail = response.Payload
        ? Buffer.from(response.Payload).toString('utf8')
        : '';
      this.logger.error(
        `Lambda retornou erro (${response.FunctionError}): ${detail}`,
      );
      throw this.failure();
    }

    const parsed = this.parsePayload(response.Payload);
    if (!parsed || typeof parsed.key !== 'string' || parsed.key.length === 0) {
      this.logger.error('Resposta da Lambda sem `key` válida.');
      throw this.failure();
    }
    return { key: parsed.key };
  }

  private parsePayload(payload?: Uint8Array): { key?: unknown } | null {
    if (!payload) return null;
    try {
      return JSON.parse(Buffer.from(payload).toString('utf8')) as {
        key?: unknown;
      };
    } catch {
      return null;
    }
  }

  private failure(): AppException {
    return new AppException(
      'REPORT_GENERATION_FAILED',
      'Não foi possível gerar o relatório. Tente novamente.',
      HttpStatus.BAD_GATEWAY,
    );
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
