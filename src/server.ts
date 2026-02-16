import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { validateConfig } from './config.js';
import { HardcoverClient } from './hardcover-client.js';
import { logger, requestLogger, currentLogLevel } from './logger.js';
import { DatabaseService } from './database.js';


// Import controllers and service factory
import { ServiceFactory } from './services/service-factory.js';
import { AuthController } from './controllers/auth.controller.js';
import { RecommendationController } from './controllers/recommendation.controller.js';
import { SettingsController } from './controllers/settings.controller.js';
import { AdminController } from './controllers/admin.controller.js';
import { TBRController } from './controllers/tbr.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version?: string; name?: string };
const APP_VERSION = packageJson.version || '0.0.0';
const APP_NAME = packageJson.name || 'BookRex';

// Validate configuration on startup (but make BookLore credentials optional for web mode)
try {
  validateConfig();
  logger.debug('Configuration validated successfully');
} catch (error) {
  // In web mode, BookLore credentials are provided by users via UI
  logger.warn('Configuration validation warning (expected in web mode)', {
    message: error instanceof Error ? error.message : 'Unknown error',
  });
}

const app = express();
const PORT = process.env.PORT || 3000;

function resolveTrustProxySetting(): any {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw.trim() === '') {
    return process.env.NODE_ENV === 'production' ? 1 : undefined;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === 'false' || normalized === '0') {
    return undefined;
  }
  if (normalized === 'true') {
    return true;
  }

  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  return raw;
}

const trustProxySetting = resolveTrustProxySetting();
if (trustProxySetting !== undefined) {
  app.set('trust proxy', trustProxySetting);
  logger.info('Trust proxy enabled', { trustProxy: trustProxySetting });
}

// Middleware
app.use(cors());
app.use(express.json());
const secureCookies = process.env.SESSION_SECURE_COOKIES === 'true';
const sessionConfig: session.SessionOptions = {
  secret: process.env.SESSION_SECRET || 'booklore-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
  },
};

app.use(session(sessionConfig));
app.use(requestLogger);

logger.info('Session middleware configured', {
  secureCookies,
  cookieMaxAgeMs: sessionConfig.cookie?.maxAge,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: currentLogLevel,
  trustProxy: trustProxySetting ?? false,
});

// Serve static files from public directory
// Disable default index to handle root route manually for cache busting
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath, { index: false }));

// Helper to serve HTML with cache-busted script tags
const serveHtml = (filePath: string, res: Response) => {
  const fs = require('fs');
  fs.readFile(filePath, 'utf8', (err: Error, data: string) => {
    if (err) {
      logger.error('Error reading HTML file', { error: err.message, path: filePath });
      return res.status(500).send('Internal Server Error');
    }
    // Inject version into app.js script tag
    const versionedHtml = data.replace(
      'src="/app.js"', 
      `src="/app.js?v=${APP_VERSION}"`
    ).replace(
      'src="/app.js?v=1.5.2"', // Handle the manual fix if present
      `src="/app.js?v=${APP_VERSION}"`
    ).replace(
      'href="/styles.css"',
      `href="/styles.css?v=${APP_VERSION}"`
    );
    
    res.send(versionedHtml);
  });
};

// Page routes
app.get('/', (req, res) => {
  serveHtml(path.join(publicPath, 'index.html'), res);
});

app.get('/settings', (req, res) => {
  serveHtml(path.join(publicPath, 'settings.html'), res);
});

app.get('/stats', (req, res) => {
  serveHtml(path.join(publicPath, 'stats.html'), res);
});

app.use(express.static(publicPath));

// Session type declaration
declare module 'express-session' {
  interface SessionData {
    initialized: boolean;
    userId?: number; // Database user ID
    guestData?: import('./types.js').GuestData;
  }
}

// Initialize HardcoverClient for global use (book details, TBR, etc.)
// This client uses the .env API key and is shared across all users for public book data
const hardcoverClient = new HardcoverClient({
  apiToken: process.env.HARDCOVER_API_TOKEN || '',
});

// Initialize Service Factory and Controllers
const serviceFactory = new ServiceFactory(hardcoverClient);
const authController = new AuthController(serviceFactory);
const recommendationController = new RecommendationController(serviceFactory);
const settingsController = new SettingsController(serviceFactory);
const adminController = new AdminController();
const tbrController = new TBRController(hardcoverClient);


// Error handler middleware
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Health check and version
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/version', (_req: Request, res: Response) => {
  res.json({ version: APP_VERSION, name: APP_NAME });
});

// ========== Authentication Routes ==========
app.get('/api/auth/status', asyncHandler(authController.status));
app.post('/api/auth/register', asyncHandler(authController.register));
app.post('/api/auth/login', asyncHandler(authController.login));
app.post('/api/auth/guest', asyncHandler(authController.guestLogin));
app.post('/api/auth/logout', asyncHandler(authController.logout));

// ========== Settings Routes ==========
app.post('/api/settings/booklore', asyncHandler(settingsController.saveBookLoreCredentials));
app.delete('/api/settings/booklore', asyncHandler(settingsController.removeBookLoreCredentials));
app.post('/api/settings/hardcover', asyncHandler(settingsController.saveHardcoverCredentials));
app.delete('/api/settings/hardcover', asyncHandler(settingsController.removeHardcoverCredentials));
app.post('/api/settings/goodreads', asyncHandler(settingsController.uploadGoodreads));
app.delete('/api/settings/goodreads', asyncHandler(settingsController.removeGoodreads));
app.post('/api/settings/data-source', asyncHandler(settingsController.updateDataSource));
app.get('/api/exclusion', asyncHandler(settingsController.getExclusionList));
app.post('/api/exclusion', asyncHandler(settingsController.addToExclusionList));
app.delete('/api/exclusion/:bookId', asyncHandler(settingsController.removeFromExclusionList));

// ========== Recommendation Routes ==========
app.get('/api/stats', asyncHandler(recommendationController.getStats));
app.post('/api/recommendations/similar', asyncHandler(recommendationController.getSimilar));
app.post('/api/recommendations/contrasting', asyncHandler(recommendationController.getContrasting));
app.post('/api/recommendations/blindspots', asyncHandler(recommendationController.getBlindspots));
app.post('/api/recommendations/custom', asyncHandler(recommendationController.getCustom));

// SSE Streaming Recommendation Routes
app.get('/api/recommendations/similar/stream', asyncHandler(recommendationController.getSimilarStream));
app.get('/api/recommendations/contrasting/stream', asyncHandler(recommendationController.getContrastingStream));
app.get('/api/recommendations/blindspots/stream', asyncHandler(recommendationController.getBlindspotStream));
app.get('/api/recommendations/custom/stream', asyncHandler(recommendationController.getCustomStream));

// ========== Admin Routes ==========
app.get('/api/admin/users', asyncHandler(adminController.listUsers));
app.delete('/api/admin/users/:userId', asyncHandler(adminController.deleteUser));
app.post('/api/admin/users/:userId/password', asyncHandler(adminController.changePassword));
app.post('/api/admin/users/:userId/admin', asyncHandler(adminController.toggleAdmin));

// ========== TBR (To Be Read) Routes ==========
app.get('/api/books/details', asyncHandler(tbrController.getBookDetails));
app.get('/api/tbr', asyncHandler(tbrController.getTBRList));
app.post('/api/tbr', asyncHandler(tbrController.addToTBR));
app.delete('/api/tbr/:bookId', asyncHandler(tbrController.removeFromTBR));
app.delete('/api/tbr', asyncHandler(tbrController.clearTBR));


// Serve index.html for all other routes (SPA support)
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    sessionId: req.sessionID,
  });

  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.DEBUG === 'true' && { stack: err.stack }),
  });
});

// Start server
app.listen(PORT, () => {
  logger.info('🚀 Book Rex Server started', {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    healthEndpoint: `/api/health`,
    logLevel: currentLogLevel,
  });
});
