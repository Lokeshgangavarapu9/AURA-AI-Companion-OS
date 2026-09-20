/**
 * AURA Authentication API Routes
 * Endpoints for registration, login, token validation, password recovery, and session revocation.
 */

import { Router } from 'express';
import { authController } from '../../auth/auth.controller.js';
import { authenticateUser } from '../../middleware/auth.middleware.js';

const authRouter = Router();

// Public Authentication Endpoints
authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
authRouter.post('/forgot-password', authController.forgotPassword);
authRouter.post('/reset-password', authController.resetPassword);

// Protected Authentication Endpoints
authRouter.get('/me', authenticateUser, authController.getMe);
authRouter.post('/logout', authenticateUser, authController.logout);

export default authRouter;
