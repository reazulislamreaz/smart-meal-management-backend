-- Meal plan generation resolves every AI-generated recipe to a catalog row by title,
-- which Prisma compiles to `LOWER("title") IN (LOWER($1), ...)`. Without a matching
-- expression index that lookup is a sequential scan over the whole meals catalog on
-- every generation, and the catalog grows with each generated plan.
CREATE INDEX IF NOT EXISTS "meals_title_lower_idx" ON "meals" (LOWER("title"));
