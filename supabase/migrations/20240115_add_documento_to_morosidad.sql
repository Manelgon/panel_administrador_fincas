-- Add documento column to morosidad table
ALTER TABLE morosidad
ADD COLUMN IF NOT EXISTS documento text;
