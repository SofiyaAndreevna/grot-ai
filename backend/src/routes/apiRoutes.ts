import type { ErrorRequestHandler } from 'express';
import { Router } from 'express';
import { ZodError } from 'zod';
import { createEpicHandler, deleteEpicHandler, getEpics, renameEpicHandler } from '../controllers/epicController';
import { getHealth } from '../controllers/healthController';
import {
  createProjectHandler,
  deleteProjectHandler,
  getProjectsHandler,
  updateProjectHandler,
} from '../controllers/projectController';
import { ApiError } from '../errors/ApiError';

const router = Router();

router.get('/health', getHealth);
router.get('/projects', getProjectsHandler);
router.post('/projects', createProjectHandler);
router.patch('/projects/:id', updateProjectHandler);
router.delete('/projects/:id', deleteProjectHandler);
router.get('/epics', getEpics);
router.post('/epics', createEpicHandler);
router.patch('/epics/:id', renameEpicHandler);
router.delete('/epics/:id', deleteEpicHandler);

const validationErrorMapper: ErrorRequestHandler = (error, _req, _res, next) => {
  if (error instanceof ZodError) {
    return next(new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', error.flatten()));
  }

  next(error);
};

router.use(validationErrorMapper);

export default router;
