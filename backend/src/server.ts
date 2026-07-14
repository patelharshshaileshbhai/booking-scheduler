import 'dotenv/config';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import pinoHttp from 'pino-http';
import logger from './config/logger';
import prisma, { connectDatabase } from './config/db';
import { connectRedis } from './config/redis';
import { apiLimiter } from './middleware/rateLimit';
import authRouter from './routes/auth';
import availabilityRouter from './routes/availability';
import bookingRouter from './routes/booking';
import linkRouter from './routes/link';

const app = express();

// Attach request logging before the rest of the middleware so every API call is tracked.
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({
      requestId: req.id,
    }),
  })
);
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true, credentials: true }));
app.use(express.json());
app.use(apiLimiter);

app.use('/api/auth', authRouter);
app.use('/api/availability', availabilityRouter);
app.use('/api/booking', bookingRouter);
app.use('/api/link', linkRouter);

app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));

app.use((_req: Request, res: Response) => res.status(404).json({ error: 'Not found' }));
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled request error');
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = Number(process.env.PORT) || 5000;

if (require.main === module) {
  (async () => {
    try {
      // Fail fast on broken infrastructure at startup, but keep Redis optional.
      await connectDatabase();
      logger.info('Database connected');

      const redisConnected = await connectRedis();
      if (redisConnected) {
        logger.info('Redis connected');
      } else {
        logger.warn('Redis unavailable; using local cache');
      }

      app.listen(PORT, () => {
        logger.info(`Server ready on http://localhost:${PORT}`);
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to start server');
      process.exit(1);
    }
  })();
}

export default app;