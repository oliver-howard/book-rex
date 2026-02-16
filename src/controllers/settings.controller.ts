import { Request, Response } from 'express';
import { DatabaseService } from '../database.js';
import { GoodreadsParser } from '../goodreads-parser.js';
import { ServiceFactory } from '../services/service-factory.js';
import { BookLoreClient } from '../booklore-client.js';
import { HardcoverClient } from '../hardcover-client.js';
import { DataSourcePreference } from '../types.js';

/**
 * Settings Controller
 * Handles user settings routes
 */
export class SettingsController {
  private serviceFactory: ServiceFactory;

  constructor(serviceFactory: ServiceFactory) {
    this.serviceFactory = serviceFactory;
  }

  /**
   * Configure BookLore credentials
   * POST /api/settings/booklore
   */
  saveBookLoreCredentials = async (req: Request, res: Response) => {
    // Allow guest
    const userId = req.session.userId;
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    try {
      // Verify credentials first
      const client = new BookLoreClient(username, password);
      await client.authenticate();

      if (userId) {
        // Update credentials in database
        DatabaseService.updateBookLoreCredentials(userId, username, password);
      } else {
        // Guest mode
        if (!req.session.guestData) {
           req.session.guestData = { readings: [], tbr: [], exclusions: [], dataSourcePreference: 'auto' };
        }
        req.session.guestData.bookloreUsername = username;
        req.session.guestData.booklorePassword = password;
      }

      // Clear service instance to force re-initialization with new credentials
      this.serviceFactory.removeService(req.sessionID);

      res.json({
        success: true,
        message: 'BookLore credentials saved successfully',
      });
    } catch (error) {
      // Check if it's an authentication error
      const errorMessage = error instanceof Error ? error.message : 'Failed to save credentials';
      const isAuthError = errorMessage.includes('Authentication failed') || errorMessage.includes('401') || errorMessage.includes('403');
      
      res.status(isAuthError ? 400 : 500).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  /**
   * Remove BookLore credentials
   * DELETE /api/settings/booklore
   */
  removeBookLoreCredentials = async (req: Request, res: Response) => {
    const userId = req.session.userId;

    try {
      if (userId) {
        DatabaseService.clearBookLoreCredentials(userId);
      } else if (req.session.guestData) {
        delete req.session.guestData.bookloreUsername;
        delete req.session.guestData.booklorePassword;
      }
      
      this.serviceFactory.removeService(req.sessionID);

      res.json({
        success: true,
        message: 'BookLore credentials removed',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove credentials',
      });
    }
  };

  /**
   * Configure Hardcover credentials
   * POST /api/settings/hardcover
   */
  saveHardcoverCredentials = async (req: Request, res: Response) => {
    // Allow guest
    const userId = req.session.userId;
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API Key is required',
      });
    }

    try {
      // Verify the API key before saving
      const verification = await HardcoverClient.verifyApiKey(apiKey);
      
      if (!verification.valid) {
        return res.status(400).json({
          success: false,
          message: verification.error || 'Invalid API key',
        });
      }
      
      if (userId) {
        // Save verified credentials
        DatabaseService.updateHardcoverCredentials(userId, apiKey);
      } else {
        // Guest mode
        if (!req.session.guestData) {
           req.session.guestData = { readings: [], tbr: [], exclusions: [], dataSourcePreference: 'auto' };
        }
        req.session.guestData.hardcoverApiKey = apiKey;
      }
      
      // Clear service instance to force re-initialization
      this.serviceFactory.removeService(req.sessionID);

      res.json({
        success: true,
        message: 'Hardcover API Key saved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save credentials',
      });
    }
  };

  /**
   * Remove Hardcover credentials
   * DELETE /api/settings/hardcover
   */
  removeHardcoverCredentials = async (req: Request, res: Response) => {
    const userId = req.session.userId;

    try {
      if (userId) {
        DatabaseService.clearHardcoverCredentials(userId);
      } else if (req.session.guestData) {
        delete req.session.guestData.hardcoverApiKey;
      }
      
      this.serviceFactory.removeService(req.sessionID);

      res.json({
        success: true,
        message: 'Hardcover credentials removed',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove credentials',
      });
    }
  };

  /**
   * Upload Goodreads CSV
   * POST /api/settings/goodreads
   */
  uploadGoodreads = async (req: Request, res: Response) => {
    // Allow guest or authenticated
    const userId = req.session.userId;

    const { csvContent } = req.body;

    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'CSV content is required',
      });
    }

    try {
      const readings = GoodreadsParser.parseCSV(csvContent);

      if (readings.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No read books found in CSV file. Make sure you have books marked as "read" in Goodreads.',
        });
      }

      if (userId) {
        DatabaseService.updateGoodreadsReadings(userId, readings);
      } else {
        // Guest mode: store in session
        if (!req.session.guestData) {
           req.session.guestData = { readings: [], tbr: [], exclusions: [], dataSourcePreference: 'auto' };
        }
        req.session.guestData.readings = readings;
      }
      
      this.serviceFactory.removeService(req.sessionID);

      res.json({
        success: true,
        message: `Successfully imported ${readings.length} books from Goodreads`,
        booksCount: readings.length,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to parse CSV file',
      });
    }
  };

  /**
   * Remove Goodreads data
   * DELETE /api/settings/goodreads
   */
  removeGoodreads = async (req: Request, res: Response) => {
    const userId = req.session.userId;

    try {
      if (userId) {
        DatabaseService.clearGoodreadsReadings(userId);
      } else if (req.session.guestData) {
        req.session.guestData.readings = [];
      }
      
      this.serviceFactory.removeService(req.sessionID);

      res.json({
        success: true,
        message: 'Goodreads data removed',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove Goodreads data',
      });
    }
  };

  /**
   * Update preferred data source
   * POST /api/settings/data-source
   */
  updateDataSource = async (req: Request, res: Response) => {
    const userId = req.session.userId;

    const { preference } = req.body as { preference: DataSourcePreference };

    if (!preference || !['auto', 'booklore', 'goodreads', 'hardcover'].includes(preference)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid data source preference',
      });
    }

    if (userId) {
      const user = DatabaseService.getUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const hasBookLore = !!(user.bookloreUsername && user.booklorePassword);
      const hasGoodreads = !!(user.goodreadsReadings && user.goodreadsReadings.length > 0);
      const hasHardcover = !!user.hardcoverApiKey;

      if (preference === 'booklore' && !hasBookLore) {
        return res.status(400).json({
          success: false,
          message: 'Connect BookLore to use it as a data source.',
        });
      }

      if (preference === 'goodreads' && !hasGoodreads) {
        return res.status(400).json({
          success: false,
          message: 'Upload Goodreads data to use it as a data source.',
        });
      }

      if (preference === 'hardcover' && !hasHardcover) {
        return res.status(400).json({
          success: false,
          message: 'Connect Hardcover to use it as a data source.',
        });
      }

      DatabaseService.updateDataSourcePreference(userId, preference);
    } else {
      // Guest mode
      if (!req.session.guestData) {
        return res.status(400).json({ success: false, message: 'No guest data found' });
      }
      
      const hasGoodreads = req.session.guestData.readings.length > 0;
      const hasBookLore = !!(req.session.guestData.bookloreUsername && req.session.guestData.booklorePassword);
      const hasHardcover = !!req.session.guestData.hardcoverApiKey;
      
      if (preference === 'booklore' && !hasBookLore) {
          return res.status(400).json({
           success: false,
           message: 'Connect BookLore to use it as a data source.',
         });
      }
      
      if (preference === 'hardcover' && !hasHardcover) {
          return res.status(400).json({
           success: false,
           message: 'Connect Hardcover to use it as a data source.',
         });
      }
      
      if (preference === 'goodreads' && !hasGoodreads) {
        return res.status(400).json({
          success: false,
          message: 'Upload Goodreads data to use it as a data source.',
        });
      }
      
      req.session.guestData.dataSourcePreference = preference;
    }

    this.serviceFactory.removeService(req.sessionID);

    res.json({
      success: true,
      message: 'Data source preference updated',
    });
  };

  /**
   * Get exclusion list
   * GET /api/exclusion
   */
  getExclusionList = async (req: Request, res: Response) => {
    // Allow guest
    const userId = req.session.userId;

    try {
      let list;
      if (userId) {
        list = DatabaseService.getExclusionList(userId);
      } else {
        list = req.session.guestData?.exclusions || [];
      }
      res.json({ list });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get exclusion list',
      });
    }
  };

  /**
   * Add to exclusion list
   * POST /api/exclusion
   */
  addToExclusionList = async (req: Request, res: Response) => {
    const userId = req.session.userId;
    const { book } = req.body;

    if (!book || !book.title || !book.author) {
      return res.status(400).json({
        success: false,
        message: 'Book title and author are required',
      });
    }

    try {
      // Generate ID if not provided
      const id = book.id || `${book.title.toLowerCase()}-${book.author.toLowerCase()}`.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const addedAt = new Date().toISOString();
      
      let newBook;
      
      if (userId) {
        newBook = DatabaseService.addToExclusionList(userId, {
          ...book,
          id,
        });
      } else {
        // Guest mode
        if (!req.session.guestData) {
           req.session.guestData = { readings: [], tbr: [], exclusions: [], dataSourcePreference: 'auto' };
        }
        
        // Check duplicates
        const existing = req.session.guestData.exclusions.find(b => b.id === id);
        if (existing) {
          throw new Error('Book already in exclusion list');
        }
        
        newBook = {
          ...book,
          id,
          addedAt,
          reasoning: book.reasoning || null,
          coverUrl: book.coverUrl || null,
        };
        
        req.session.guestData.exclusions.push(newBook);
      }

      res.json({
        success: true,
        message: 'Book added to exclusion list',
        book: newBook,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add to exclusion list',
      });
    }
  };

  /**
   * Remove from exclusion list
   * DELETE /api/exclusion/:bookId
   */
  removeFromExclusionList = async (req: Request, res: Response) => {
    const userId = req.session.userId;
    const { bookId } = req.params;

    try {
      if (userId) {
        DatabaseService.removeFromExclusionList(userId, bookId);
      } else if (req.session.guestData) {
        req.session.guestData.exclusions = req.session.guestData.exclusions.filter(b => b.id !== bookId);
      }
      
      res.json({
        success: true,
        message: 'Book removed from exclusion list',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove from exclusion list',
      });
    }
  };
}
