import {
  buildBudgetComparison,
  withMealPlanResponse,
} from './meal-plan-response.util';

describe('meal-plan-response.util', () => {
  it('builds budget comparison message', () => {
    const comparison = buildBudgetComparison(115, 98.5, 'USD');

    expect(comparison.isOverBudget).toBe(false);
    expect(comparison.targetBudget).toBe(115);
    expect(comparison.totalEstimatedCost).toBe(98.5);
    expect(comparison.message).toContain('under budget');
  });

  it('exposes mealPlan and plan aliases', () => {
    const mealPlan = { id: 'plan-1', items: [] };
    const response = withMealPlanResponse({ hasActivePlan: true }, mealPlan);

    expect(response.mealPlan).toBe(mealPlan);
    expect(response.plan).toBe(mealPlan);
  });
});
