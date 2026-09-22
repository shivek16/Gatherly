import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import userRoutes from './routes/users.routes.js';
import { connectToSocket } from './controllers/socketManager.js';
export function createAppServer({ frontendDir = process.env.SERVE_FRONTEND === 'true' ? fileURLToPath(new URL('../../frontend/build/', import.meta.url)) : null } = {}) {
  const app = express();
  const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim());
  if (process.env.RENDER_EXTERNAL_URL) origins.push(process.env.RENDER_EXTERNAL_URL);
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) throw new Error('TRUST_PROXY_HOPS must be a nonnegative integer.');
  if (trustProxyHops) app.set('trust proxy', trustProxyHops);
  const corsOptions = {
    origin: origins
  };
  app.disable('x-powered-by');
  app.use(cors(corsOptions));
  app.use(express.json({
    limit: '40kb'
  }));
  app.get('/health', (_req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    service: 'Gatherly',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable'
  }));
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      message: 'Too many attempts. Please try again in 15 minutes.'
    }
  });
  app.use('/api/v1/users/login', limiter);
  app.use('/api/v1/users/register', limiter);
  app.use('/api/v1/users', userRoutes);
  // Never turn an unknown API endpoint into an HTML success response.
  app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found' }));
  if (frontendDir) {
    const indexFile = path.resolve(frontendDir, 'index.html');
    if (!existsSync(indexFile)) throw new Error('Frontend build missing. Run npm run build before starting production.');
    app.use(express.static(frontendDir));
    // React routes, including direct links to a meeting, load the same application.
    app.get(['/', '/auth', '/home', '/history', '/:url'], (req, res, next) => {
      if (req.params.url && !/^[a-zA-Z0-9_-]{3,64}$/.test(req.params.url)) return next();
      res.sendFile(indexFile);
    });
  }
  app.use((_req, res) => res.status(404).json({
    message: 'Not found'
  }));
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({
    message: 'Invalid request body'
  }));
  const server = createServer(app);
  const io = connectToSocket(server, corsOptions);
  return {
    app,
    server,
    io
  };
}


