import { Request, Response } from 'express';
import { DatabaseService } from '../database.js';
import { logger } from '../logger.js';
import { ServiceFactory } from '../services/service-factory.js';

/**
 * Authentication Controller
 * Handles user authentication routes
 */
export class AuthController {
  private serviceFactory: ServiceFactory;

  constructor(serviceFactory: ServiceFactory) {
    this.serviceFactory = serviceFactory;
  }

  /**
   * Check authentication status
   * GET /api/auth/status
   */
  /**
   * Check authentication status
   * GET /api/auth/status
   */
  status = async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    if (req.session.userId) {
      const user = DatabaseService.getUserById(req.session.userId);
      if (user) {
        logger.debug('Auth status check: Authenticated', { username: user.username, userId: user.id });
        const hasBookLore = !!(user.bookloreUsername && user.booklorePassword);
        const hasGoodreads = !!(user.goodreadsReadings && user.goodreadsReadings.length > 0);
        const hasHardcover = !!user.hardcoverApiKey;
        const hasReadingHistory = hasBookLore || hasGoodreads || hasHardcover;

        res.json({
          authenticated: true,
          username: user.username,
          hasReadingHistory,
          hasBookLore,
          hasGoodreads,
          hasHardcover,
          booksCount: user.goodreadsReadings?.length || 0,
          dataSourcePreference: user.dataSourcePreference || 'auto',
          canChooseDataSource: (hasBookLore ? 1 : 0) + (hasGoodreads ? 1 : 0) + (hasHardcover ? 1 : 0) >= 2,
          isAdmin: user.isAdmin,
          isGuest: false,
        });
        return;
      } else {
        logger.warn('Auth status check: User not found in DB', { userId: req.session.userId });
      }
    } else if (req.session.guestData) {
       // Guest session
       const guestData = req.session.guestData;
       const hasGoodreads = guestData.readings.length > 0;
       const hasBookLore = !!(guestData.bookloreUsername && guestData.booklorePassword);
       const hasHardcover = !!guestData.hardcoverApiKey;
       const hasReadingHistory = hasGoodreads || hasBookLore || hasHardcover;
       
       res.json({
          authenticated: true,
          username: 'Guest',
          hasReadingHistory,
          hasBookLore,
          hasGoodreads,
          hasHardcover,
          booksCount: guestData.readings.length,
          dataSourcePreference: guestData.dataSourcePreference,
          canChooseDataSource: (hasBookLore ? 1 : 0) + (hasGoodreads ? 1 : 0) + (hasHardcover ? 1 : 0) >= 2,
          isAdmin: false,
          isGuest: true,
       });
       return;
    } else {
      logger.debug('Auth status check: No session userId or guestData');
    }
    res.json({ authenticated: false });
  };

  /**
   * Register new user
   * POST /api/auth/register
   */
  register = async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      logger.warn('Registration attempt missing credentials', {
        usernameProvided: Boolean(username),
        ip: req.ip,
      });
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    try {
      logger.info('Registration attempt', {
        username,
        ip: req.ip,
      });
      const user = await DatabaseService.createUser(username, password);

      // Log user in immediately
      req.session.userId = user.id;
      req.session.initialized = true;
      // Clear any guest data
      delete req.session.guestData;

      logger.info('User registered successfully', {
        username: user.username,
        sessionId: req.sessionID,
      });

      res.json({
        success: true,
        message: 'Account created successfully',
        username: user.username,
      });
    } catch (error) {
      logger.warn('Registration failed', {
        username,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed',
      });
    }
  };

  /**
   * Login with local account
   * POST /api/auth/login
   */
  login = async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      logger.warn('Login attempt missing credentials', {
        usernameProvided: Boolean(username),
        ip: req.ip,
      });
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    try {
      logger.info('Login attempt', {
        username,
        ip: req.ip,
        sessionId: req.sessionID,
      });
      const user = await DatabaseService.authenticateUser(username, password);

      req.session.userId = user.id;
      req.session.initialized = true;
      // Clear any guest data
      delete req.session.guestData;

      logger.info('Login successful', {
        username: user.username,
        userId: user.id,
        sessionId: req.sessionID,
      });

      res.json({
        success: true,
        message: 'Login successful',
        username: user.username,
      });
    } catch (error) {
      logger.warn('Login failed', {
        username,
        ip: req.ip,
        sessionId: req.sessionID,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Authentication failed',
      });
    }
  };

  /**
   * Guest Login
   * POST /api/auth/guest
   */
  guestLogin = async (req: Request, res: Response) => {
    logger.info('Guest login attempt', { sessionId: req.sessionID });
    
    // Initialize guest session
    req.session.guestData = {
      readings: [],
      tbr: [],
      exclusions: [],
      dataSourcePreference: 'auto',
    };
    req.session.initialized = true;
    delete req.session.userId; // Ensure no user ID

    res.json({
      success: true,
      message: 'Guest session initialized',
      username: 'Guest',
    });
  };

  /**
   * Logout
   * POST /api/auth/logout
   */
  logout = async (req: Request, res: Response) => {
    const sessionId = req.sessionID;
    logger.info('Logout requested', {
      sessionId,
      userId: req.session.userId,
    });

    // Remove service instance
    this.serviceFactory.removeService(sessionId);

    // Clear session
    req.session.destroy((err) => {
      if (err) {
        logger.error('Error destroying session', {
          error: err instanceof Error ? err.message : err,
          sessionId,
        });
      }
    });

    res.json({ success: true, message: 'Logged out successfully' });
  };
}
