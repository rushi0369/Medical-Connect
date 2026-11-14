import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import {
  forgotPasswordLimiter,
  loginLimiter,
  registerLimiter,
  resetPasswordLimiter,
} from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validators/auth.validators.js';

const router = Router();

router.get('/session', auth.getSession);
router.post('/register', registerLimiter, validate({ body: registerSchema }), auth.register);
router.post('/login', loginLimiter, validate({ body: loginSchema }), auth.login);
router.post('/logout', authenticate, auth.logout);
router.post('/change-password', authenticate, validate({ body: changePasswordSchema }), auth.changePassword);
router.post('/forgot-password', forgotPasswordLimiter, validate({ body: forgotPasswordSchema }), auth.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, validate({ body: resetPasswordSchema }), auth.resetPassword);

export default router;
