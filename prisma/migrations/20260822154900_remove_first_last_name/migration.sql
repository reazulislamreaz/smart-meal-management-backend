-- Migrate firstName + lastName into name when name is empty, then drop the split fields.
UPDATE "users"
SET "name" = TRIM(CONCAT(COALESCE("firstName", ''), ' ', COALESCE("lastName", '')))
WHERE ("name" IS NULL OR TRIM("name") = '')
  AND (COALESCE("firstName", '') <> '' OR COALESCE("lastName", '') <> '');

ALTER TABLE "users" DROP COLUMN "firstName";
ALTER TABLE "users" DROP COLUMN "lastName";
