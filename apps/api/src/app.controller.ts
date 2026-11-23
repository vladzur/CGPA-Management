import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Access } from './common/access/access.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Access('PUBLIC')
  getHello(): string {
    return this.appService.getHello();
  }
}
