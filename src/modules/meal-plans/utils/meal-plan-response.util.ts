export interface BudgetComparison {
  targetBudget: number;
  totalEstimatedCost: number;
  budgetDelta: number;
  isOverBudget: boolean;
  message: string;
  currency: string;
}

export function buildBudgetComparison(
  targetBudget: number,
  totalEstimatedCost: number,
  currency = 'USD',
): BudgetComparison {
  const roundedTotal = Math.round(totalEstimatedCost * 100) / 100;
  const budgetDelta = Math.round((roundedTotal - targetBudget) * 100) / 100;
  const isOverBudget = budgetDelta > 0;

  return {
    targetBudget,
    totalEstimatedCost: roundedTotal,
    budgetDelta: Math.abs(budgetDelta),
    isOverBudget,
    currency,
    message: isOverBudget
      ? `Est. cost ${currency} ${roundedTotal.toFixed(2)} / ${currency} ${targetBudget.toFixed(2)} → ${currency} ${budgetDelta.toFixed(2)} over budget`
      : `Est. cost ${currency} ${roundedTotal.toFixed(2)} / ${currency} ${targetBudget.toFixed(2)} → ${currency} ${Math.abs(budgetDelta).toFixed(2)} under budget`,
  };
}

/**
 * Ensures API responses expose `mealPlan` (documented contract) and `plan` (legacy alias).
 */
export function withMealPlanResponse<T extends Record<string, unknown>>(
  payload: T,
  mealPlan: unknown,
): T & { mealPlan: unknown; plan: unknown } {
  return {
    ...payload,
    mealPlan,
    plan: mealPlan,
  };
}
