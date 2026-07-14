import bcrypt from 'bcryptjs';
import { Router, type NextFunction, type Request, type Response } from 'express';
import prisma from '../config/db';
import { authLimiter } from '../middleware/rateLimit';
import { signAccessToken, requireAuth } from '../middleware/auth';

type CredentialsBody = {
  email?: unknown;
  password?: unknown;
};

const router = Router();

function validateCredentials(email: unknown, password: unknown): string[] {
  const errors: string[] = [];

  if (typeof email !== 'string' || !email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
    errors.push('Enter a valid email address.');
  }

  if (typeof password !== 'string' || password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }

  return errors;
}

router.post(
  '/register',
  authLimiter,
  async (req: Request<{}, unknown, CredentialsBody>, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body ?? {};
      const errors = validateCredentials(email, password);

      if (errors.length) {
        return res.status(400).json({ error: errors[0], errors });
      }

      const normalizedEmail = String(email).toLowerCase().trim();
      const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existingUser) {
        return res.status(409).json({ error: 'Email is already registered.' });
      }

      const passwordHash = await bcrypt.hash(String(password), 12);
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });

      const token = signAccessToken(user);
      return res.status(201).json({ user, token });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/login',
  authLimiter,
  async (req: Request<{}, unknown, CredentialsBody>, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body ?? {};
      const errors = validateCredentials(email, password);

      if (errors.length) {
        return res.status(400).json({ error: errors[0], errors });
      }

      const normalizedEmail = String(email).toLowerCase().trim();
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const isMatch = await bcrypt.compare(String(password), user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const safeUser = { id: user.id, email: user.email, createdAt: user.createdAt };
      const token = signAccessToken(safeUser);
      return res.json({ user: safeUser, token });
    } catch (error) {
      return next(error);
    }
  }
);

router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

export default router;