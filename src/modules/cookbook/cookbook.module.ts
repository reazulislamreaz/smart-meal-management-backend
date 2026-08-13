import { Module } from '@nestjs/common';
import { CookbookService } from './cookbook.service';
import { CookbookController } from './cookbook.controller';

@Module({
  controllers: [CookbookController],
  providers: [CookbookService],
  exports: [CookbookService],
})
export class CookbookModule {}
