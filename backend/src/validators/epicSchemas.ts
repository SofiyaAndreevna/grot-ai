import { z } from 'zod';

export const queryProjectSchema = z.object({
  projectId: z.string().trim().min(1),
});

export const createEpicBodySchema = z.object({
  projectId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
});

export const renameEpicBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const epicParamsSchema = z.object({
  id: z.string().trim().regex(/^\d+$/),
});
