-- more chart intervals: M30, W1 (Monday 00:00 UTC) and MN1 (calendar month, UTC)
ALTER TYPE "Timeframe" ADD VALUE IF NOT EXISTS 'm30';
ALTER TYPE "Timeframe" ADD VALUE IF NOT EXISTS 'w1';
ALTER TYPE "Timeframe" ADD VALUE IF NOT EXISTS 'mn1';
