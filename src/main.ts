import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS for local dev
  app.enableCors();

  // Global ValidationPipe – auto-validates all incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global Response Interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Swagger / OpenAPI ───────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DUT Job Fair 2025 – API')
    .setDescription(
      `REST API backend cho hệ thống quản lý hội chợ việc làm DUT 2025.\n\n` +
      `- Xác thực JWT Bearer Token\n` +
      `- Scanner QR check-in chống duplicate 5 phút\n` +
      `- Dashboard riêng cho School Admin và Business Admin`,
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .addTag('auth', 'Xác thực tài khoản')
    .addTag('scanner', 'Quét QR check-in')
    .addTag('students', 'Quản lý sinh viên')
    .addTag('schools', 'Quản lý trường')
    .addTag('businesses', 'Quản lý doanh nghiệp')
    .addTag('booths', 'Quản lý gian hàng')
    .addTag('checkins', 'Lịch sử check-in')
    .addTag('school-admin', 'Dashboard School Admin')
    .addTag('business-admin', 'Dashboard Business Admin')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,  // giữ token sau khi reload
      tagsSorter: 'alpha',
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 API: http://localhost:${port}/api`);
  console.log(`📖 Swagger: http://localhost:${port}/docs`);
  console.log(`📄 OpenAPI JSON: http://localhost:${port}/docs-json`);
}
bootstrap();
