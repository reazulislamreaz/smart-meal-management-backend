import { BadRequestException } from '@nestjs/common';
import {
  assertValidMealFrequency,
  countMealsByType,
  distributeMealSlots,
  legacyToMealFrequency,
  mealFrequencyTotal,
  resolveMealFrequency,
} from './meal-frequency.util';

describe('meal-frequency.util', () => {
  describe('resolveMealFrequency', () => {
    it('prefers explicit mealFrequency from request DTO', () => {
      const result = resolveMealFrequency(
        { mealFrequency: { breakfast: 0, lunch: 3, dinner: 5 } },
        {
          mealFrequencyBreakfast: 7,
          mealFrequencyLunch: 7,
          mealFrequencyDinner: 7,
          plannedMealTypes: ['BREAKFAST', 'LUNCH', 'DINNER'],
          plannedDaysCount: 7,
        },
      );

      expect(result).toEqual({ breakfast: 0, lunch: 3, dinner: 5 });
    });

    it('falls back to saved user meal frequency fields', () => {
      const result = resolveMealFrequency(undefined, {
        mealFrequencyBreakfast: 7,
        mealFrequencyLunch: 0,
        mealFrequencyDinner: 5,
        plannedMealTypes: ['BREAKFAST', 'LUNCH', 'DINNER'],
        plannedDaysCount: 7,
      });

      expect(result).toEqual({ breakfast: 7, lunch: 0, dinner: 5 });
    });

    it('falls back to legacy plannedMealTypes × plannedDaysCount', () => {
      const result = resolveMealFrequency(
        { plannedMealTypes: ['LUNCH', 'DINNER'], plannedDaysCount: 7 },
        { plannedMealTypes: [], plannedDaysCount: 7 },
      );

      expect(result).toEqual({ breakfast: 0, lunch: 7, dinner: 7 });
    });
  });

  describe('assertValidMealFrequency', () => {
    it('rejects all-zero meal frequency', () => {
      expect(() =>
        assertValidMealFrequency({ breakfast: 0, lunch: 0, dinner: 0 }),
      ).toThrow(BadRequestException);
    });

    it('rejects negative values', () => {
      expect(() =>
        assertValidMealFrequency({ breakfast: -1, lunch: 3, dinner: 5 }),
      ).toThrow(BadRequestException);
    });

    it('accepts valid frequency', () => {
      expect(() =>
        assertValidMealFrequency({ breakfast: 0, lunch: 3, dinner: 5 }),
      ).not.toThrow();
    });
  });

  describe('distributeMealSlots', () => {
    it('creates exactly 8 slots for breakfast=0 lunch=3 dinner=5', () => {
      const slots = distributeMealSlots(
        { breakfast: 0, lunch: 3, dinner: 5 },
        7,
      );

      expect(slots).toHaveLength(8);
      expect(countMealsByType(slots)).toEqual({
        BREAKFAST: 0,
        LUNCH: 3,
        DINNER: 5,
      });
    });

    it('creates 21 slots for 7/7/7 frequency', () => {
      const slots = distributeMealSlots(
        { breakfast: 7, lunch: 7, dinner: 7 },
        7,
      );

      expect(slots).toHaveLength(21);
      expect(mealFrequencyTotal({ breakfast: 7, lunch: 7, dinner: 7 })).toBe(21);
    });

    it('creates 12 slots for breakfast=7 lunch=0 dinner=5', () => {
      const slots = distributeMealSlots(
        { breakfast: 7, lunch: 0, dinner: 5 },
        7,
      );

      expect(slots).toHaveLength(12);
      expect(countMealsByType(slots)).toEqual({
        BREAKFAST: 7,
        LUNCH: 0,
        DINNER: 5,
      });
    });
  });

  describe('legacyToMealFrequency', () => {
    it('maps legacy meal types to per-day counts', () => {
      expect(legacyToMealFrequency(['BREAKFAST', 'DINNER'], 5)).toEqual({
        breakfast: 5,
        lunch: 0,
        dinner: 5,
      });
    });
  });
});
