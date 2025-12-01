import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 전역 예외 처리: 모든 에러를 일관된 형식으로 반환
  app.useGlobalFilters(new AllExceptionsFilter());

  // 전역 응답 변환: 모든 응답을 일관된 형식으로 래핑
  app.useGlobalInterceptors(new TransformInterceptor());

  // 전역 Validation Pipe: DTO 검증 및 타입 변환
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // 자동 타입 변환 (class-transformer 사용)
      whitelist: true, // DTO에 정의되지 않은 속성 제거
      forbidNonWhitelisted: true, // DTO에 없는 속성이 있으면 에러 발생
    }),
  );

  // CORS 설정
  app.enableCors();

  // Global prefix 설정
  app.setGlobalPrefix('chain');

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`Server is running on: http://localhost:${port}`);
}

bootstrap();
