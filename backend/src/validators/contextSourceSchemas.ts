import { z } from 'zod';

export const contextSourceQuerySchema = z.object({
  projectId: z.string().trim().regex(/^\d+$/),
});

export const createContextSourceBodySchema = z.object({
  projectId: z.string().trim().regex(/^\d+$/),
  type: z.literal('github'),
  name: z.string().trim().min(1).max(255),
  url: z.string().trim().url().max(2048),
});

export const contextSourceParamsSchema = z.object({
  id: z.string().trim().regex(/^\d+$/),
});
