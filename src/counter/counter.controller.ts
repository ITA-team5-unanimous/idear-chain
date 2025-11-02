import { Controller, Get, Post } from '@nestjs/common';
import { CounterService } from './counter.service';

@Controller('counter')
export class CounterController {
  constructor(private readonly counterService: CounterService) {}

  @Get()
  async getCount() {
    const count = await this.counterService.getCount();
    return { count };
  }

  @Get('info')
  getContractInfo() {
    return this.counterService.getContractInfo();
  }

  @Post('increment')
  async increment() {
    return this.counterService.increment();
  }

  @Post('decrement')
  async decrement() {
    return this.counterService.decrement();
  }

  @Post('reset')
  async reset() {
    return this.counterService.reset();
  }
}
