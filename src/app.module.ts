import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { validateEnv } from './config/env.validation';
import { MembersModule } from './modules/members/members.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { TenantContextMiddleware } from './modules/prisma/tenant-context.middleware';
import { MinistriesModule } from './modules/ministries/ministries.module';
import { AccountModule } from './modules/account/account.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
    MembersModule,
    MinistriesModule,
    AccountModule,
    CategoriesModule,
    TransactionsModule,
    DashboardModule,
    ReportsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Com o prefixo global, '{*splat}' vira '/v1/{*splat}' e NÃO casa a rota
    // raiz '/v1' — por isso o '/' extra (vira '/v1' e cobre a raiz).
    consumer.apply(TenantContextMiddleware).forRoutes('/', '{*splat}');
  }
}
