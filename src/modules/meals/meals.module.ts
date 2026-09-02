import { Module } from '@nestjs/common';
import { MealsService } from './meals.service';
import { MealsController } from './meals.controller';
import { NutritionService } from './nutrition.service';

@Module({
  controllers: [MealsController],
  providers: [MealsService, NutritionService],
  exports: [MealsService, NutritionService],
})
export class MealsModule {}
