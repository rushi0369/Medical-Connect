import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { verifyOrigin } from './middleware/verifyOrigin.js';
import apiRoutes from './routes/index.js';
import { findImage, openImage } from './services/storage.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
// credentials: true lets the browser send the HTTP-only login cookie.
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(verifyOrigin);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Serve uploaded prescription photos from GridFS
async function serveUploadedImage(req, res, next) {
  try {
    const file = await findImage(req.params.id);
    if (!file) return next();
    res.setHeader('Content-Type', file.metadata?.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return openImage(req.params.id).pipe(res);
  } catch (err) {
    return next(err);
  }
}

app.get('/uploads/:id', serveUploadedImage);
app.get('/api/uploads/:id', serveUploadedImage);

app.use('/api', apiRoutes);

// If production frontend build exists, serve static assets and SPA routes
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
