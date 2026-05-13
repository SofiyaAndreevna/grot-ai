import { z } from 'zod';

export const createProjectBodySchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
});

export const updateProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const projectParamsSchema = z.object({
  id: z.string().trim().min(1),
});
