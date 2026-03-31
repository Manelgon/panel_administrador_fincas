-- Make aviso column nullable in morosidad table
ALTER TABLE morosidad
ALTER COLUMN aviso DROP NOT NULL;
