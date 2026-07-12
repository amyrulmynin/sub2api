-- Product-facing batch image billing uses MYR. Existing rows remain unchanged;
-- only newly inserted rows that omit currency receive the deployment default.
ALTER TABLE batch_image_jobs
    ALTER COLUMN currency SET DEFAULT 'MYR';
