import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 전역 예외 처리: 모든 에러를 일관된 형식으로 반환
  app.useGlobalFilters(new AllExceptionsFilter());

  // 전역 응답 변환: 모든 응답을 일관된 형식으로 래핑
  app.useGlobalInterceptors(new TransformInterceptor());

  // CORS 설정
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`Server is running on: http://localhost:${port}`);
}

bootstrap();
