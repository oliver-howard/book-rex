import { Request, Response } from 'express';
import { DatabaseService } from '../database.js';
import { ServiceFactory } from '../services/service-factory.js';
import { ReadingAnalysis } from '../types.js';
import { initSSEResponse, sendSSEProgress, sendSSEComplete, sendSSEError } from '../utils/sse-utils.js';
import { logger } from '../logger.js';

/**
 * Recommendation Controller
 * Handles book recommendation routes
 */
export class RecommendationController {
  private serviceFactory: ServiceFactory;

  constructor(serviceFactory: ServiceFactory) {
    this.serviceFactory = serviceFactory;
  }

  /**
   * Get user statistics
   * GET /api/stats
   */
  getStats = async (req: Request, res: Response) => {
    try {
      const service = await this.serviceFactory.getService(req);
      // For guest, we might not have a userId, but service can handle it if we pass undefined or handle inside service
      // Service.getUserStats currently expects userId. Let's see if we can adapt it or if ServiceFactory returns a service 
      // that already knows its data.
      // Actually RecommendationService.getUserStats takes userId.
      // We should check if we are guest.
      const userId = req.session.userId;
      
      let stats;
      if (userId) {
        stats = await service.getUserStats(userId);
      } else if (req.session.guestData) {
        // Mock stats for guest or implement logic in service to accept readings directly
        // The service.getUserStats calls DatabaseService.getUserById usually.
        // We might need to implement a 'getStats' on the service that works with internal state?
        // Or just calculate here for guest.
        const readings = req.session.guestData.readings;
        stats = {
          totalReadings: readings.length,
          favoriteGenres: [], // derived from readings?
          favoriteAuthors: [],
          recentReadings: readings.slice(0, 5)
        };
        // This is a simplification. Ideally RecommendationService has a method that works on 'this.readings'
      } else {
        stats = { totalReadings: 0, favoriteGenres: [], favoriteAuthors: [], recentReadings: [] };
      }
      
      res.json(stats);
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get stats',
      });
    }
  };

  /**
   * Get similar recommendations
   * POST /api/recommendations/similar
   */
  getSimilar = async (req: Request, res: Response) => {
    try {
      const service = await this.serviceFactory.getService(req);
      const { maxRecommendations } = req.body;
      
      const tbrBooks = req.session.userId 
        ? DatabaseService.getTBRList(req.session.userId) 
        : (req.session.guestData?.tbr || []);
        
      const exclusionList = req.session.userId 
        ? DatabaseService.getExclusionList(req.session.userId) 
        : (req.session.guestData?.exclusions || []);

      const recommendations = await service.getRecommendations(
        'similar',
        maxRecommendations,
        tbrBooks,
        exclusionList
      );
      res.json({ recommendations });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get recommendations',
      });
    }
  };

  /**
   * Get contrasting recommendations
   * POST /api/recommendations/contrasting
   */
  getContrasting = async (req: Request, res: Response) => {
    try {
      const service = await this.serviceFactory.getService(req);
      const { maxRecommendations } = req.body;
      
      const tbrBooks = req.session.userId 
        ? DatabaseService.getTBRList(req.session.userId) 
        : (req.session.guestData?.tbr || []);
        
      const exclusionList = req.session.userId 
        ? DatabaseService.getExclusionList(req.session.userId) 
        : (req.session.guestData?.exclusions || []);

      const recommendations = await service.getRecommendations(
        'contrasting',
        maxRecommendations,
        tbrBooks,
        exclusionList
      );
      res.json({ recommendations });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get recommendations',
      });
    }
  };

  /**
   * Get blind spots analysis
   * POST /api/recommendations/blindspots
   */
  getBlindspots = async (req: Request, res: Response) => {
    try {
      const service = await this.serviceFactory.getService(req);
      const analysis = (await service.getRecommendations('blindspots')) as ReadingAnalysis;
      res.json({ analysis });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get blind spots',
      });
    }
  };

  /**
   * Get custom recommendations
   * POST /api/recommendations/custom
   */
  getCustom = async (req: Request, res: Response) => {
    try {
      const service = await this.serviceFactory.getService(req);
      const { criteria, maxRecommendations } = req.body;

      if (!criteria) {
        return res.status(400).json({
          success: false,
          message: 'Criteria is required for custom recommendations',
        });
      }

      const tbrBooks = req.session.userId 
        ? DatabaseService.getTBRList(req.session.userId) 
        : (req.session.guestData?.tbr || []);
        
      const exclusionList = req.session.userId 
        ? DatabaseService.getExclusionList(req.session.userId) 
        : (req.session.guestData?.exclusions || []);

      const recommendations = await service.getCustomRecommendations(
        criteria,
        maxRecommendations,
        tbrBooks,
        exclusionList
      );
      res.json({ recommendations });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get custom recommendations',
      });
    }
  };

  // ========== SSE Streaming Endpoints ==========

  /**
   * Get similar recommendations with SSE progress
   * GET /api/recommendations/similar/stream
   */
  getSimilarStream = async (req: Request, res: Response) => {
    try {
      initSSEResponse(res);
      
      const service = await this.serviceFactory.getService(req);
      
      const tbrBooks = req.session.userId 
        ? DatabaseService.getTBRList(req.session.userId) 
        : (req.session.guestData?.tbr || []);
        
      const exclusionList = req.session.userId 
        ? DatabaseService.getExclusionList(req.session.userId) 
        : (req.session.guestData?.exclusions || []);
      
      const onProgress = (stage: string, percent: number, message: string) => {
        sendSSEProgress(res, stage, percent, message);
      };
      
      const recommendations = await service.getRecommendations(
        'similar',
        undefined,
        tbrBooks,
        exclusionList,
        onProgress
      );
      
      sendSSEComplete(res, { recommendations });
    } catch (error) {
      logger.error('Error in getSimilarStream', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sessionId: req.sessionID
      });
      sendSSEError(res, error instanceof Error ? error.message : 'Failed to get recommendations');
    }
  };

  /**
   * Get contrasting recommendations with SSE progress
   * GET /api/recommendations/contrasting/stream
   */
  getContrastingStream = async (req: Request, res: Response) => {
    try {
      initSSEResponse(res);
      
      const service = await this.serviceFactory.getService(req);
      const tbrBooks = req.session.userId 
        ? DatabaseService.getTBRList(req.session.userId) 
        : (req.session.guestData?.tbr || []);
        
      const exclusionList = req.session.userId 
        ? DatabaseService.getExclusionList(req.session.userId) 
        : (req.session.guestData?.exclusions || []);
      
      const onProgress = (stage: string, percent: number, message: string) => {
        sendSSEProgress(res, stage, percent, message);
      };
      
      const recommendations = await service.getRecommendations(
        'contrasting',
        undefined,
        tbrBooks,
        exclusionList,
        onProgress
      );
      
      sendSSEComplete(res, { recommendations });
    } catch (error) {
      logger.error('Error in getContrastingStream', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sessionId: req.sessionID
      });
      sendSSEError(res, error instanceof Error ? error.message : 'Failed to get recommendations');
    }
  };

  /**
   * Get blind spots analysis with SSE progress
   * GET /api/recommendations/blindspots/stream
   */
  getBlindspotStream = async (req: Request, res: Response) => {
    try {
      initSSEResponse(res);
      
      const service = await this.serviceFactory.getService(req);
      
      const onProgress = (stage: string, percent: number, message: string) => {
        sendSSEProgress(res, stage, percent, message);
      };
      
      const analysis = (await service.getRecommendations('blindspots', undefined, undefined, undefined, onProgress)) as ReadingAnalysis;
      
      sendSSEComplete(res, { analysis });
    } catch (error) {
      logger.error('Error in getBlindspotStream', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sessionId: req.sessionID
      });
      sendSSEError(res, error instanceof Error ? error.message : 'Failed to get blind spots');
    }
  };

  /**
   * Get custom recommendations with SSE progress
   * GET /api/recommendations/custom/stream?criteria=...
   */
  getCustomStream = async (req: Request, res: Response) => {
    try {
      const criteria = req.query.criteria as string;
      
      if (!criteria) {
        return res.status(400).json({
          success: false,
          message: 'Criteria is required for custom recommendations',
        });
      }

      initSSEResponse(res);
      
      const service = await this.serviceFactory.getService(req);
      const tbrBooks = req.session.userId 
        ? DatabaseService.getTBRList(req.session.userId) 
        : (req.session.guestData?.tbr || []);
        
      const exclusionList = req.session.userId 
        ? DatabaseService.getExclusionList(req.session.userId) 
        : (req.session.guestData?.exclusions || []);
      
      const onProgress = (stage: string, percent: number, message: string) => {
        sendSSEProgress(res, stage, percent, message);
      };
      
      const recommendations = await service.getCustomRecommendations(
        criteria,
        undefined,
        tbrBooks,
        exclusionList,
        onProgress
      );
      
      sendSSEComplete(res, { recommendations });
    } catch (error) {
      logger.error('Error in getCustomStream', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sessionId: req.sessionID
      });
      sendSSEError(res, error instanceof Error ? error.message : 'Failed to get custom recommendations');
    }
  };
}
