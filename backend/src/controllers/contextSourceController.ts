import type { RequestHandler } from 'express';
import { ApiError } from '../errors/ApiError';
import {
  createContextSource,
  deleteContextSourceById,
  getContextSourcesByProjectId,
} from '../services/contextSourceService';
import {
  contextSourceParamsSchema,
  contextSourceQuerySchema,
  createContextSourceBodySchema,
} from '../validators/contextSourceSchemas';

function ensurePgError(error: unknown): error is { code?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export const createContextSourceHandler: RequestHandler = async (req, res, next) => {
  try {
    const payload = createContextSourceBodySchema.parse(req.body);
    const contextSource = await createContextSource(payload);

    res.status(201).json({ contextSource });
  } catch (error) {
    if (ensurePgError(error) && error.code === '23503') {
      return next(new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND'));
    }

    next(error);
  }
};

export const getContextSourcesHandler: RequestHandler = async (req, res, next) => {
  try {
    const { projectId } = contextSourceQuerySchema.parse(req.query);
    const contextSources = await getContextSourcesByProjectId({ projectId });

    res.json({ contextSources });
  } catch (error) {
    next(error);
  }
};

export const deleteContextSourceHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = contextSourceParamsSchema.parse(req.params);
    const isDeleted = await deleteContextSourceById({ id });

    if (!isDeleted) {
      return next(new ApiError(404, 'Context source not found', 'CONTEXT_SOURCE_NOT_FOUND'));
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
