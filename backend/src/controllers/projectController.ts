import type { RequestHandler } from 'express';
import { ApiError } from '../errors/ApiError';
import { createProject, deleteProject, getProjects, updateProject } from '../services/projectService';
import { createProjectBodySchema, projectParamsSchema, updateProjectBodySchema } from '../validators/projectSchemas';

function ensurePgError(error: unknown): error is { code?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export const getProjectsHandler: RequestHandler = async (_req, res, next) => {
  try {
    const projects = await getProjects();
    res.json({ projects });
  } catch (error) {
    next(error);
  }
};

export const createProjectHandler: RequestHandler = async (req, res, next) => {
  try {
    const payload = createProjectBodySchema.parse(req.body);
    const project = await createProject(payload);

    res.status(201).json({ project });
  } catch (error) {
    if (ensurePgError(error) && error.code === '23505') {
      return next(new ApiError(409, 'Project with this id already exists', 'PROJECT_CONFLICT'));
    }

    next(error);
  }
};

export const updateProjectHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = projectParamsSchema.parse(req.params);
    const { name } = updateProjectBodySchema.parse(req.body);
    const project = await updateProject({ id, name });

    if (!project) {
      return next(new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND'));
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
};

export const deleteProjectHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = projectParamsSchema.parse(req.params);
    const isDeleted = await deleteProject(id);

    if (!isDeleted) {
      return next(new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND'));
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
