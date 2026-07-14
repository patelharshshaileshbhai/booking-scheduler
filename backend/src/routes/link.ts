import { randomUUID } from 'crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import prisma from '../config/db';
import { requireAuth } from '../middleware/auth';
import { cacheJson, readJson, removeKey } from '../config/redis';

type PublicLink = {
  id: string;
  ownerId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  bookingUrl: string;
};

const router = Router();

function serializeLink(link: {
  id: string;
  ownerId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}): PublicLink {
  return {
    id: link.id,
    ownerId: link.ownerId,
    token: link.token,
    expiresAt: link.expiresAt,
    createdAt: link.createdAt,
    bookingUrl: `${process.env.PUBLIC_APP_URL || 'http://localhost:5173'}/book/${link.token}`,
  };
}

router.post('/generate', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const link = await prisma.link.create({
      data: {
        ownerId: req.user!.id,
        token: randomUUID(),
        expiresAt,
      },
    });

    const response = serializeLink(link);
    await cacheJson(`booking-link:${link.token}`, response, 60 * 10);
    return res.status(201).json({ link: response });
  } catch (error) {
    return next(error);
  }
});

router.get('/mine', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const links = await prisma.link.findMany({
      where: { ownerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ links: links.map(serializeLink) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:token', async (req: Request<{ token: string }>, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const cached = await readJson<PublicLink>(`booking-link:${token}`);
    if (cached) {
      return res.json({ link: cached });
    }

    const link = await prisma.link.findUnique({ where: { token } });
    if (!link || (link.expiresAt && link.expiresAt < new Date())) {
      return res.status(404).json({ error: 'Booking link not found.' });
    }

    const response = serializeLink(link);
    await cacheJson(`booking-link:${token}`, response, 60 * 10);
    return res.json({ link: response });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:token', requireAuth, async (req: Request<{ token: string }>, res: Response, next: NextFunction) => {
  try {
    const link = await prisma.link.findFirst({
      where: { token: req.params.token, ownerId: req.user!.id },
    });

    if (!link) {
      return res.status(404).json({ error: 'Booking link not found.' });
    }

    await prisma.link.delete({ where: { id: link.id } });
    await removeKey(`booking-link:${req.params.token}`);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;