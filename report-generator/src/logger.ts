import { Logger } from '@aws-lambda-powertools/logger';

/** Logger estruturado (CloudWatch): duração de render, tamanho do PDF, cold start. */
export const logger = new Logger({ serviceName: 'report-generator' });
