import { Request } from 'express';
import { RecommendationService } from '../recommendation-service.js';
import { DatabaseService } from '../database.js';
import { HardcoverClient } from '../hardcover-client.js';
import { logger } from '../logger.js';

/**
 * Service Factory
 * Manages RecommendationService instances per user session
 */
export class ServiceFactory {
  private sessionServices: Map<string, RecommendationService> = new Map();
  private globalHardcoverClient: HardcoverClient;

  constructor(globalHardcoverClient: HardcoverClient) {
    this.globalHardcoverClient = globalHardcoverClient;
  }

  /**
   * Get or create RecommendationService for a user session
   */
  async getService(req: Request): Promise<RecommendationService> {
    const sessionId = req.sessionID;
    logger.debug('Fetching RecommendationService for session', {
      sessionId,
      userId: req.session.userId,
    });

    // Check for authentication or guest mode
    const userId = req.session.userId;
    const isGuest = !userId;

    if (!userId && (!req.session.guestData && !req.session.initialized)) {
      // Initialize guest data if not present
      req.session.guestData = {
        readings: [],
        tbr: [],
        exclusions: [],
        dataSourcePreference: 'auto',
      };
      req.session.initialized = true;
      logger.info('Initialized guest session', { sessionId });
    }

    // Get or create service for this session
    let service = this.sessionServices.get(sessionId);

    if (!service) {
      if (userId) {
        // Authenticated User Logic
        const user = DatabaseService.getUserById(userId);
        if (!user) {
          logger.warn('User not found for session', {
            sessionId,
            userId,
          });
          throw new Error('User not found');
        }

        logger.debug('Creating new RecommendationService instance', {
          sessionId,
          userId: user.id,
        });

        // Create user-specific HardcoverClient if user has API key
        let userHardcoverClient: HardcoverClient | undefined;
        if (user.hardcoverApiKey) {
          userHardcoverClient = new HardcoverClient({
            apiToken: user.hardcoverApiKey,
          });
        }

        service = new RecommendationService(
          undefined, // AI config
          user.bookloreUsername,
          user.booklorePassword,
          user.goodreadsReadings,
          user.dataSourcePreference,
          userHardcoverClient,
          this.globalHardcoverClient
        );

        // Initialize BookLore if creds exist
        if (user.bookloreUsername && user.booklorePassword) {
          await service.initialize();
        }
      } else {
        // Guest User Logic
        logger.debug('Creating new Guest RecommendationService instance', { sessionId });
        
        const guestData = req.session.guestData!;
        
        // Create user-specific HardcoverClient if guest has API key
        let userHardcoverClient: HardcoverClient | undefined;
        if (guestData.hardcoverApiKey) {
          userHardcoverClient = new HardcoverClient({
            apiToken: guestData.hardcoverApiKey,
          });
        }
        
        service = new RecommendationService(
          undefined, // AI config
          guestData.bookloreUsername,
          guestData.booklorePassword,
          guestData.readings,
          guestData.dataSourcePreference,
          userHardcoverClient,
          this.globalHardcoverClient
        );
        
        // Initialize BookLore if creds exist
        if (guestData.bookloreUsername && guestData.booklorePassword) {
           await service.initialize();
        }
      }

      this.sessionServices.set(sessionId, service);
    }

    return service;
  }


  /**
   * Remove service instance for a session (e.g., on logout or settings change)
   */
  removeService(sessionId: string): void {
    this.sessionServices.delete(sessionId);
    logger.debug('Removed service for session', { sessionId });
  }

  /**
   * Get all active session IDs
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.sessionServices.keys());
  }
}
