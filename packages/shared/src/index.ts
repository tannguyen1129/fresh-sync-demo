export * from './enums';
export * from './schemas';
export * from './events';

// Re-export common types
export const APP_NAME = "FreshSync";
export const DATE_FORMAT = "YYYY-MM-DD HH:mm:ss";

// --- Health Check Types (Fix lỗi TS2305) ---
import { z } from 'zod';

export const HealthCheckSchema = z.object({
  ok: z.boolean(),
  timestamp: z.string().datetime().optional(),
  service: z.string().optional()
});

export type HealthCheckResponse = z.infer<typeof HealthCheckSchema>;