import { Router, type NextFunction, type Request, type Response } from 'express';
import prisma from '../config/db';
import { requireAuth } from '../middleware/auth';
import { isValidDateInput, isValidTimeInput, toUtcDate } from '../utils/time';

type AvailabilityBody = {
  date?: unknown;
  startTime?: unknown;
  endTime?: unknown;
};

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const availability = await prisma.availability.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return res.json({ availability });
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/',
  async (req: Request<{}, unknown, AvailabilityBody>, res: Response, next: NextFunction) => {
    try {
      const { date, startTime, endTime } = req.body ?? {};
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

      if (errors.length) {
        return res.status(400).json({ error: errors[0], errors });
      }

      const normalizedStartTime = startTime as string;
      const normalizedEndTime = endTime as string;
      const start = normalizedStartTime.split(':').map(Number);
      const end = normalizedEndTime.split(':').map(Number);
      const startMinutes = start[0] * 60 + start[1];
      const endMinutes = end[0] * 60 + end[1];

      if (endMinutes <= startMinutes) {
        return res.status(400).json({ error: 'End time must be after start time.' });
      }

      const created = await prisma.availability.create({
        data: {
          userId: req.user!.id,
          date: toUtcDate(date) as Date,
          startTime: normalizedStartTime,
          endTime: normalizedEndTime,
        },
      });

      return res.status(201).json({ availability: created });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;