import { Router } from 'express';
import healthRoutes from './health.routes.js';
import chatRoutes from './chat.routes.js';
import { sessionRouter } from './session.routes.js';
import memoryRoutes from './memory.routes.js';
import settingsRoutes from './settings.routes.js';
import profileRoutes from './profile.routes.js';
import authRoutes from './auth.routes.js';
import visionRoutes from './vision.routes.js';
import workspaceRoutes from './workspace.routes.js';

const apiRouter = Router();

// Mount API v1 routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/', healthRoutes);
apiRouter.use('/', chatRoutes);
apiRouter.use('/sessions', sessionRouter);
apiRouter.use('/', memoryRoutes);
apiRouter.use('/', settingsRoutes);
apiRouter.use('/', profileRoutes);
apiRouter.use('/', visionRoutes);
apiRouter.use('/', workspaceRoutes);

export default apiRouter;
