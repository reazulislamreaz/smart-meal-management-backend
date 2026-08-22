import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_PLANNING_DAYS,
  MAX_MEAL_FREQUENCY_PER_TYPE,
  MAX_PLANNING_DAYS,
} from '../dto/meal-frequency.dto';

export type MealTypeKey = 'BREAKFAST' | 'LUNCH' | 'DINNER';

export interface MealFrequency {
  breakfast: number;
  lunch: number;
  dinner: number;
}

export interface MealSlot {
  dayOfWeek: number;
  mealType: MealTypeKey;
}

export interface MealFrequencyUserFields {
  mealFrequencyBreakfast?: number | null;
  mealFrequencyLunch?: number | null;
  mealFrequencyDinner?: number | null;
  plannedMealTypes?: string[];
  plannedDaysCount?: number | null;
}

export interface MealFrequencyRequestFields {
  mealFrequency?: Partial<MealFrequency>;
  plannedMealTypes?: string[];
  plannedDaysCount?: number;
  daysCount?: number;
  mealTypes?: string[];
}

const MEAL_TYPE_ORDER: Record<MealTypeKey, number> = {
  BREAKFAST: 0,
  LUNCH: 1,
  DINNER: 2,
};

export function mealFrequencyTotal(frequency: MealFrequency): number {
  return frequency.breakfast + frequency.lunch + frequency.dinner;
}

export function normalizeMealFrequency(
  partial: Partial<MealFrequency> | undefined,
): MealFrequency | null {
  if (!partial) {
    return null;
  }

  const hasAnyField =
    partial.breakfast !== undefined ||
    partial.lunch !== undefined ||
    partial.dinner !== undefined;

  if (!hasAnyField) {
    return null;
  }

  return {
    breakfast: partial.breakfast ?? 0,
    lunch: partial.lunch ?? 0,
    dinner: partial.dinner ?? 0,
  };
}

export function assertValidMealFrequency(frequency: MealFrequency): void {
  const fields: Array<keyof MealFrequency> = ['breakfast', 'lunch', 'dinner'];

  for (const field of fields) {
    const value = frequency[field];
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      Number.isNaN(value) ||
      value < 0 ||
      value > MAX_MEAL_FREQUENCY_PER_TYPE
    ) {
      throw new BadRequestException(
        `Invalid meal frequency for ${field}: must be an integer between 0 and ${MAX_MEAL_FREQUENCY_PER_TYPE}.`,
      );
    }
  }

  if (mealFrequencyTotal(frequency) === 0) {
    throw new BadRequestException(
      'At least one meal must be requested. Set breakfast, lunch, or dinner count greater than 0.',
    );
  }
}

export function legacyToMealFrequency(
  mealTypes: string[],
  daysCount: number,
): MealFrequency {
  const normalizedTypes = new Set(mealTypes.map((type) => type.trim().toUpperCase()));
  const safeDays = Math.max(1, Math.min(daysCount, MAX_PLANNING_DAYS));

  return {
    breakfast: normalizedTypes.has('BREAKFAST') ? safeDays : 0,
    lunch: normalizedTypes.has('LUNCH') ? safeDays : 0,
    dinner: normalizedTypes.has('DINNER') ? safeDays : 0,
  };
}

export function mealFrequencyToLegacy(frequency: MealFrequency): {
  plannedMealTypes: string[];
  plannedDaysCount: number;
} {
  const plannedMealTypes: string[] = [];
  if (frequency.breakfast > 0) plannedMealTypes.push('BREAKFAST');
  if (frequency.lunch > 0) plannedMealTypes.push('LUNCH');
  if (frequency.dinner > 0) plannedMealTypes.push('DINNER');

  const plannedDaysCount = Math.min(
    Math.max(frequency.breakfast, frequency.lunch, frequency.dinner, DEFAULT_PLANNING_DAYS),
    MAX_PLANNING_DAYS,
  );

  return { plannedMealTypes, plannedDaysCount };
}

export function userHasSavedMealFrequency(user: MealFrequencyUserFields): boolean {
  const total =
    (user.mealFrequencyBreakfast ?? 0) +
    (user.mealFrequencyLunch ?? 0) +
    (user.mealFrequencyDinner ?? 0);

  return total > 0;
}

export function mealFrequencyFromUser(user: MealFrequencyUserFields): MealFrequency {
  return {
    breakfast: user.mealFrequencyBreakfast ?? 0,
    lunch: user.mealFrequencyLunch ?? 0,
    dinner: user.mealFrequencyDinner ?? 0,
  };
}

export function resolveMealFrequency(
  dto?: MealFrequencyRequestFields,
  user?: MealFrequencyUserFields,
): MealFrequency {
  const fromDto = normalizeMealFrequency(dto?.mealFrequency);
  if (fromDto) {
    return fromDto;
  }

  if (user && userHasSavedMealFrequency(user)) {
    return mealFrequencyFromUser(user);
  }

  const legacyDays =
    dto?.daysCount ?? dto?.plannedDaysCount ?? user?.plannedDaysCount ?? DEFAULT_PLANNING_DAYS;
  const legacyTypes =
    (dto?.mealTypes && dto.mealTypes.length > 0
      ? dto.mealTypes
      : dto?.plannedMealTypes && dto.plannedMealTypes.length > 0
        ? dto.plannedMealTypes
        : user?.plannedMealTypes) ?? [];

  if (legacyTypes.length > 0) {
    return legacyToMealFrequency(legacyTypes, legacyDays);
  }

  return legacyToMealFrequency(
    ['BREAKFAST', 'LUNCH', 'DINNER'],
    DEFAULT_PLANNING_DAYS,
  );
}

export function resolvePlanningDaysCount(
  explicitDays: number | undefined,
  userDays: number | undefined | null,
  frequency: MealFrequency,
): number {
  if (explicitDays !== undefined && explicitDays > 0) {
    return Math.min(explicitDays, MAX_PLANNING_DAYS);
  }

  const maxFrequency = Math.max(
    frequency.breakfast,
    frequency.lunch,
    frequency.dinner,
    1,
  );
  const derived = Math.max(maxFrequency, userDays ?? DEFAULT_PLANNING_DAYS);

  return Math.min(derived, MAX_PLANNING_DAYS);
}

/**
 * Distributes meal slots evenly across the planning period.
 * Ensures exact counts per meal type without duplicating meals to fill empty days.
 */
export function distributeMealSlots(
  frequency: MealFrequency,
  daysCount: number,
): MealSlot[] {
  const safeDays = Math.max(1, Math.min(daysCount, MAX_PLANNING_DAYS));
  const slots: MealSlot[] = [];

  const typeEntries: Array<{ mealType: MealTypeKey; count: number }> = [
    { mealType: 'BREAKFAST', count: frequency.breakfast },
    { mealType: 'LUNCH', count: frequency.lunch },
    { mealType: 'DINNER', count: frequency.dinner },
  ];

  for (const { mealType, count } of typeEntries) {
    if (count <= 0) {
      continue;
    }

    for (let index = 0; index < count; index++) {
      const dayOfWeek = Math.min(
        safeDays,
        Math.floor(((index + 0.5) * safeDays) / count) + 1,
      );
      slots.push({ dayOfWeek, mealType });
    }
  }

  slots.sort((left, right) => {
    if (left.dayOfWeek !== right.dayOfWeek) {
      return left.dayOfWeek - right.dayOfWeek;
    }
    return MEAL_TYPE_ORDER[left.mealType] - MEAL_TYPE_ORDER[right.mealType];
  });

  return slots;
}

export function countMealsByType(
  items: Array<{ mealType: string }>,
): Record<MealTypeKey, number> {
  const counts: Record<MealTypeKey, number> = {
    BREAKFAST: 0,
    LUNCH: 0,
    DINNER: 0,
  };

  for (const item of items) {
    const normalized = item.mealType.trim().toUpperCase() as MealTypeKey;
    if (normalized in counts) {
      counts[normalized] += 1;
    }
  }

  return counts;
}

export interface AlignableAiMeal {
  dayOfWeek?: number;
  mealType?: string;
  title: string;
  description?: string;
  prepTimeMinutes?: number;
  servings?: number;
  estimatedCost?: number;
  cuisine?: string;
  dietaryTags?: string[];
  instructions?: string[];
  ingredients?: Array<{ name: string; quantity: string; category?: string }>;
}

/**
 * Aligns AI-generated meals to the required slot schedule, enforcing exact per-type counts.
 */
export function alignAiMealsToSlots<T extends AlignableAiMeal>(
  aiMeals: T[],
  slots: MealSlot[],
): Array<T & { dayOfWeek: number; mealType: MealTypeKey }> {
  const mealsByType: Record<MealTypeKey, T[]> = {
    BREAKFAST: [],
    LUNCH: [],
    DINNER: [],
  };

  for (const meal of aiMeals) {
    const normalized = (meal.mealType || 'LUNCH').trim().toUpperCase() as MealTypeKey;
    if (normalized in mealsByType) {
      mealsByType[normalized].push(meal);
    }
  }

  const unassigned = aiMeals.filter(
    (meal) =>
      !meal.mealType ||
      !(['BREAKFAST', 'LUNCH', 'DINNER'] as MealTypeKey[]).includes(
        meal.mealType.trim().toUpperCase() as MealTypeKey,
      ),
  );

  const aligned: Array<T & { dayOfWeek: number; mealType: MealTypeKey }> = [];

  for (const slot of slots) {
    const pool = mealsByType[slot.mealType];
    const meal = pool.shift() || unassigned.shift();

    if (!meal) {
      throw new Error(
        `Insufficient AI meals generated for ${slot.mealType}. Expected ${slots.filter((s) => s.mealType === slot.mealType).length} meals.`,
      );
    }

    aligned.push({
      ...meal,
      dayOfWeek: slot.dayOfWeek,
      mealType: slot.mealType,
    });
  }

  return aligned;
}
