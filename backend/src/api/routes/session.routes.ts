import { Router } from 'express';
import { sessionController } from '../controllers/session.controller.js';
import { authenticateUser } from '../../middleware/auth.middleware.js';

export const sessionRouter = Router();

sessionRouter.use(authenticateUser);

sessionRouter.get('/', sessionController.listSessions);
sessionRouter.get('/:id', sessionController.getSessionById);
sessionRouter.post('/', sessionController.createSession);
sessionRouter.patch('/:id', sessionController.updateSession);
sessionRouter.delete('/:id', sessionController.deleteSession);
