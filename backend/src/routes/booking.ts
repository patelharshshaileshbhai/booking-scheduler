import { Router, type NextFunction, type Request, type Response } from 'express';
import prisma from '../config/db';
import { requireAuth } from '../middleware/auth';
import {
  buildSlots,
  ensureSlotAlignment,
  formatDateKey,
  isValidDateInput,
  isValidTimeInput,
  toUtcDate,
} from '../utils/time';
import { cacheJson, readJson, removeKey } from '../config/redis';

type PublicTokenParams = {
  token: string;
};

type BookingQuery = {
  date?: unknown;
};

type BookingBody = {
  date?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  bookedBy?: unknown;
};

type SerializedLink = {
  id: string;
  ownerId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  bookingUrl: string;
};

const router = Router();

async function loadActiveLink(token: string): Promise<SerializedLink | null> {
  const cached = await readJson<SerializedLink>(`booking-link:${token}`);
  if (cached) {
    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      await removeKey(`booking-link:${token}`);
      return null;
    }

    return cached;
  }

  const link = await prisma.link.findUnique({ where: { token } });
  if (!link || (link.expiresAt && link.expiresAt < new Date())) {
    return null;
  }

  const serialized: SerializedLink = {
    id: link.id,
    ownerId: link.ownerId,
    token: link.token,
    expiresAt: link.expiresAt,
    createdAt: link.createdAt,
    bookingUrl: `${process.env.PUBLIC_APP_URL || 'http://localhost:5173'}/book/${link.token}`,
  };

  await cacheJson(`booking-link:${token}`, serialized, 60 * 10);
  return serialized;
}

router.get('/public/:token', async (req: Request<PublicTokenParams>, res: Response, next: NextFunction) => {
  try {
    const link = await loadActiveLink(req.params.token);
    if (!link) {
      return res.status(404).json({ error: 'Booking link not found.' });
    }

    return res.json({ link });
  } catch (error) {
    return next(error);
  }
});

router.get(
  '/public/:token/calendar',
  async (req: Request<PublicTokenParams>, res: Response, next: NextFunction) => {
    try {
      const link = await loadActiveLink(req.params.token);
      if (!link) {
        return res.status(404).json({ error: 'Booking link not found.' });
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const slots = await prisma.availability.findMany({
        where: {
          userId: link.ownerId,
          date: { gte: today },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      });

      const dates = [...new Set(slots.map((slot) => formatDateKey(slot.date)))];
      return res.json({ dates });
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  '/public/:token/slots',
  async (req: Request<PublicTokenParams, unknown, unknown, BookingQuery>, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params;
      const { date } = req.query;

      if (!isValidDateInput(date)) {
        return res.status(400).json({ error: 'Select a valid date.' });
      }

      const link = await loadActiveLink(token);
      if (!link) {
        return res.status(404).json({ error: 'Booking link not found.' });
      }

      const availability = await prisma.availability.findMany({
        where: {
          userId: link.ownerId,
          date: toUtcDate(date) as Date,
        },
        orderBy: { startTime: 'asc' },
      });

      const booked = await prisma.booking.findMany({
        where: {
          linkId: link.id,
          date: toUtcDate(date) as Date,
        },
        select: { startTime: true, endTime: true },
      });

      const bookedKeys = new Set(booked.map((entry) => `${entry.startTime}-${entry.endTime}`));
      const slots = availability.flatMap((entry) =>
        buildSlots(entry.startTime, entry.endTime).filter(
          (slot) => !bookedKeys.has(`${slot.startTime}-${slot.endTime}`)
        )
      );

      return res.json({ slots });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/public/:token',
  async (req: Request<PublicTokenParams, unknown, BookingBody>, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params;
      const { date, startTime, endTime, bookedBy } = req.body ?? {};

      const errors: string[] = [];
      if (!isValidDateInput(date)) {
        errors.push('Select a valid date.');
      }
      if (!isValidTimeInput(startTime)) {
        errors.push('Select a valid start time.');
      }
      if (!isValidTimeInput(endTime)) {
        errors.push('Select a valid end time.');
      }
      if (typeof bookedBy !== 'string' || bookedBy.trim().length < 2) {
        errors.push('Enter your name to continue.');
      }

      if (errors.length) {
        return res.status(400).json({ error: errors[0], errors });
      }

      const normalizedStartTime = startTime as string;
      const normalizedEndTime = endTime as string;
      const normalizedBookedBy = bookedBy as string;
      const link = await loadActiveLink(token);
      if (!link) {
        return res.status(404).json({ error: 'Booking link not found.' });
      }

      const selectedDate = toUtcDate(date) as Date;
      const availability = await prisma.availability.findMany({
        where: {
          userId: link.ownerId,
          date: selectedDate,
        },
      });

      const isValidSlot = availability.some((entry) =>
        buildSlots(entry.startTime, entry.endTime).some(
          (slot) => slot.startTime === normalizedStartTime && slot.endTime === normalizedEndTime
        )
      );

      if (!isValidSlot) {
        return res.status(400).json({ error: 'Selected time is no longer available.' });
      }

      if (!ensureSlotAlignment(normalizedStartTime, normalizedEndTime)) {
        return res.status(400).json({ error: 'Bookings must be in 30-minute blocks.' });
      }

      const booking = await prisma.$transaction(async (transaction) => {
        const existing = await transaction.booking.findFirst({
          where: {
            linkId: link.id,
            date: selectedDate,
            startTime: normalizedStartTime,
            endTime: normalizedEndTime,
          },
        });

        if (existing) {
          throw new Error('SLOT_TAKEN');
        }

        return transaction.booking.create({
          data: {
            linkId: link.id,
            bookedBy: normalizedBookedBy.trim(),
            date: selectedDate,
            startTime: normalizedStartTime,
            endTime: normalizedEndTime,
          },
        });
      });

      // A successful booking invalidates the cached public view so the next fetch recalculates slots.
      await removeKey(`booking-link:${token}`);
      return res.status(201).json({ booking });
    } catch (error) {
      if (error instanceof Error && error.message === 'SLOT_TAKEN') {
        return res.status(409).json({ error: 'That slot was just booked by someone else.' });
      }

      return next(error);
    }
  }
);

router.get('/mine', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const links = await prisma.link.findMany({
      where: { ownerId: req.user!.id },
      include: {
        bookings: {
          orderBy: { bookedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ links });
  } catch (error) {
    return next(error);
  }
});

export default router;