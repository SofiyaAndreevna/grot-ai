import { z } from 'zod';

export const chatParamsSchema = z.object({
  id: z.string().trim().regex(/^\d+$/),
});

export const queryEpicSchema = z.object({
  epicId: z.string().trim().min(1),
});

export const createChatBodySchema = z.object({
  epicId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(120).optional(),
  mode: z.enum(['analyst', 'developer']).optional(),
});

export const renameChatBodySchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export const sendChatMessageBodySchema = z.object({
  message: z.string().trim().min(1),
  mode: z.enum(['analyst', 'developer']).optional(),
});

export const legacyChatBodySchema = z.object({
  message: z.string().trim().min(1),
  topic: z.string().optional(),
});
