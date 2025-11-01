import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(): object {
    return this.appService.getHealth();
  }

  @Get('/health')
  checkHealth(): object {
    return this.appService.getHealth();
  }
}
