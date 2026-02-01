import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { healthRouter } from './routes/health';
import { publicRouter } from './routes/public';
import { adminRouter } from './routes/admin';

const app = express();

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json());

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { ok: false, error: 'Too many requests' },
});
app.use(generalLimiter);

app.use('/api/health', healthRouter);
app.use('/api/public', publicRouter);
app.use('/api/admin', adminRouter);

export { app };
