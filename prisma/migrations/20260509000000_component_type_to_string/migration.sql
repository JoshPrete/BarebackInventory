-- Convert Component.type from ComponentType enum to free-text string.
-- Map existing enum values to human-readable labels.
ALTER TABLE "Component"
  ALTER COLUMN "type" TYPE TEXT
  USING CASE
    WHEN "type"::TEXT = 'BILTONG_BULK' THEN 'Meat / Bulk'
    WHEN "type"::TEXT = 'PACKAGING'    THEN 'Packaging'
    ELSE "type"::TEXT
  END;

DROP TYPE "ComponentType";
