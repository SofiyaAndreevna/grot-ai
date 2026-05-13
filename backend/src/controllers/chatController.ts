import type { RequestHandler } from 'express';
import { ApiError } from '../errors/ApiError';
import { buildChatReply, createChat, deleteChat, getChatsByEpicId, renameChat, sendMessageToChat } from '../services/chatService';
import {
  chatParamsSchema,
  createChatBodySchema,
  legacyChatBodySchema,
  queryEpicSchema,
  renameChatBodySchema,
  sendChatMessageBodySchema,
} from '../validators/chatSchemas';

function ensurePgError(error: unknown): error is { code?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export const getChatsHandler: RequestHandler = async (req, res, next) => {
  try {
    const { epicId } = queryEpicSchema.parse(req.query);
    const chats = await getChatsByEpicId(epicId);

    res.json({ chats });
  } catch (error) {
    next(error);
  }
};

export const createChatHandler: RequestHandler = async (req, res, next) => {
  try {
    const payload = createChatBodySchema.parse(req.body);
    const chat = await createChat(payload);

    res.status(201).json({ chat });
  } catch (error) {
    if (ensurePgError(error) && error.code === '23503') {
      return next(new ApiError(404, 'Epic not found', 'EPIC_NOT_FOUND'));
    }

    next(error);
  }
};

export const renameChatHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = chatParamsSchema.parse(req.params);
    const { title } = renameChatBodySchema.parse(req.body);
    const chat = await renameChat({ chatId: id, title });

    if (!chat) {
      return next(new ApiError(404, 'Chat not found', 'CHAT_NOT_FOUND'));
    }

    res.json({ chat });
  } catch (error) {
    next(error);
  }
};

export const deleteChatHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = chatParamsSchema.parse(req.params);
    const isDeleted = await deleteChat(id);

    if (!isDeleted) {
      return next(new ApiError(404, 'Chat not found', 'CHAT_NOT_FOUND'));
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const sendChatMessageHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = chatParamsSchema.parse(req.params);
    const payload = sendChatMessageBodySchema.parse(req.body);
    const response = await sendMessageToChat({ chatId: id, ...payload });

    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const sendLegacyChatMessageHandler: RequestHandler = async (req, res, next) => {
  try {
    const payload = legacyChatBodySchema.parse(req.body);
    const response = buildChatReply({
      message: payload.message,
      topic: payload.topic,
      mode: 'analyst',
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
};
