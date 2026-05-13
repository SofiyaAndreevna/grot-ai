import type { RequestHandler } from 'express';
import { ApiError } from '../errors/ApiError';
import { createEpic, deleteEpic, getEpicsByProjectId, renameEpic } from '../services/epicService';
import { createEpicBodySchema, epicParamsSchema, queryProjectSchema, renameEpicBodySchema } from '../validators/epicSchemas';

function ensurePgError(error: unknown): error is { code?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export const getEpics: RequestHandler = async (req, res, next) => {
  try {
    const { projectId } = queryProjectSchema.parse(req.query);
    const epics = await getEpicsByProjectId(projectId);

    res.json({ epics });
  } catch (error) {
    next(error);
  }
};

export const createEpicHandler: RequestHandler = async (req, res, next) => {
  try {
    const payload = createEpicBodySchema.parse(req.body);
    const epic = await createEpic(payload);

    res.status(201).json({ epic });
  } catch (error) {
    if (ensurePgError(error) && error.code === '23505') {
      return next(new ApiError(409, 'Epic with this name already exists in project', 'EPIC_NAME_CONFLICT'));
    }

    next(error);
  }
};

export const renameEpicHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = epicParamsSchema.parse(req.params);
    const { name } = renameEpicBodySchema.parse(req.body);
    const epic = await renameEpic({ epicId: id, name });

    if (!epic) {
      return next(new ApiError(404, 'Epic not found', 'EPIC_NOT_FOUND'));
    }

    res.json({ epic });
  } catch (error) {
    if (ensurePgError(error) && error.code === '23505') {
      return next(new ApiError(409, 'Epic with this name already exists in project', 'EPIC_NAME_CONFLICT'));
    }

    next(error);
  }
};

export const deleteEpicHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = epicParamsSchema.parse(req.params);
    const isDeleted = await deleteEpic(id);

    if (!isDeleted) {
      return next(new ApiError(404, 'Epic not found', 'EPIC_NOT_FOUND'));
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
