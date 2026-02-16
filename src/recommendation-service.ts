import { BookLoreClient } from './booklore-client.js';
import { HardcoverClient } from './hardcover-client.js';
import { AIService } from './ai-service.js';
import {
  Recommendation,
  ReadingAnalysis,
  RecommendationType,
  AIConfig,
  UserReading,
  TBRBook,
  DataSourcePreference,
  ProgressCallback,
} from './types.js';
import { config } from './config.js';

export class RecommendationService {
  private bookloreClient?: BookLoreClient;
  private hardcoverClient?: HardcoverClient; // User-specific client for reading history only
  private globalHardcoverClient?: HardcoverClient; // Global client for book metadata searches
  private aiService: AIService;
  private guestReadings?: UserReading[];
  private dataSourcePreference: DataSourcePreference;

  constructor(
    aiConfig?: Partial<AIConfig>,
    bookloreUsername?: string,
    booklorePassword?: string,
    guestReadings?: UserReading[],
    dataSourcePreference: DataSourcePreference = 'auto',
    userHardcoverClient?: HardcoverClient, // For reading history
    globalHardcoverClient?: HardcoverClient // For book searches
  ) {
    if (bookloreUsername && booklorePassword) {
      this.bookloreClient = new BookLoreClient(bookloreUsername, booklorePassword);
    }
    this.guestReadings = guestReadings;
    this.dataSourcePreference = dataSourcePreference || 'auto';
    this.aiService = new AIService(aiConfig);
    this.hardcoverClient = userHardcoverClient;
    this.globalHardcoverClient = globalHardcoverClient;
  }

  /**
   * Initialize the service by authenticating with BookLore
   */
  async initialize(): Promise<void> {
    if (this.bookloreClient) {
      await this.bookloreClient.authenticate();
    }
  }

  /**
   * Get recommendations based on type
   */
  async getRecommendations(
    type: RecommendationType = 'similar',
    maxRecommendations?: number,
    tbrBooks?: TBRBook[],
    exclusionList?: { id: string }[],
    onProgress?: ProgressCallback
  ): Promise<Recommendation[] | ReadingAnalysis> {
    const max = maxRecommendations || config.ai.maxRecommendations;
    const source = this.determineDataSource();
    
    onProgress?.('fetching', 10, 'Fetching reading history...');
    const readings = await this.getReadingsForSource(source);
    const sourceName = source === 'booklore' ? 'BookLore' : source === 'hardcover' ? 'Hardcover' : 'Goodreads';
    console.log(`\nAnalyzing ${readings.length} books from ${sourceName}...\n`);

    switch (type) {
      case 'similar':
        const similarRecs = await this.aiService.getSimilarRecommendations(readings, tbrBooks, max, onProgress);
        return this.filterExcluded(similarRecs, exclusionList);
      case 'contrasting':
        const contrastingRecs = await this.aiService.getContrastingRecommendations(readings, tbrBooks, max, onProgress);
        return this.filterExcluded(contrastingRecs, exclusionList);
      case 'blindspots':
        const analysis = await this.aiService.analyzeReadingBlindSpots(readings, onProgress);
        // Enrich recommendations within blind spots - SKIPPED for performance (client-side fetch)
        /*
        if (analysis.blindSpots) {
          analysis.blindSpots = await Promise.all(
            analysis.blindSpots.map(async (spot) => ({
              ...spot,
              recommendations: await this.enrichWithCovers(spot.recommendations),
            }))
          );
        }
        */
        return analysis;
      default:
        throw new Error(`Unknown recommendation type: ${type}`);
    }
  }

  /**
   * Get personalized recommendations based on custom criteria
   */
  async getCustomRecommendations(
    criteria: string,
    maxRecommendations?: number,
    tbrBooks?: TBRBook[],
    exclusionList?: { id: string }[],
    onProgress?: ProgressCallback
  ): Promise<Recommendation[]> {
    const max = maxRecommendations || config.ai.maxRecommendations;
    const hasBookLore = !!this.bookloreClient;
    const hasGoodreads = !!(this.guestReadings && this.guestReadings.length > 0);

    if (!hasBookLore && !hasGoodreads) {
      console.log('\nGuest mode: Generating recommendations based on criteria only...\n');
      return this.aiService.getGenericRecommendations(criteria, tbrBooks, max, onProgress);
    }

    const source = this.determineDataSource();
    onProgress?.('fetching', 10, 'Fetching reading history...');
    const readings = await this.getReadingsForSource(source);
    const sourceName = source === 'booklore' ? 'BookLore' : source === 'hardcover' ? 'Hardcover' : 'Goodreads';
    console.log(`\nAnalyzing ${readings.length} books from ${sourceName}...\n`);

    const recommendations = await this.aiService.getPersonalizedRecommendations(readings, criteria, tbrBooks, max, onProgress);
    return this.filterExcluded(recommendations, exclusionList);
  }

  private filterExcluded(recommendations: Recommendation[], exclusionList?: { id: string }[]): Recommendation[] {
    if (!exclusionList || exclusionList.length === 0) {
      return recommendations;
    }

    const excludedIds = new Set(exclusionList.map(b => b.id));
    
    // Also generate IDs for recommendations to check against exclusion list
    // This assumes the ID generation logic is consistent between client/server/DB
    // Ideally, we should check by title/author if ID is not present on recommendation
    
    return recommendations.filter(rec => {
      // If rec has an ID, check it
      // if (rec.id && excludedIds.has(rec.id)) return false;
      
      // Generate ID from title/author
      const id = `${rec.title.toLowerCase()}-${rec.author.toLowerCase()}`
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
        
      return !excludedIds.has(id);
    });
  }

  /**
   * Get user statistics
   */
  /**
   * Get user statistics
   */
  async getUserStats(userId?: number) {
    const source = this.determineDataSource();
    console.log(`Generating stats using source: ${source}`);
    const readings = await this.getReadingsForSource(source);
    
    // Calculate counts for all sources
    const genreCount = new Map<string, number>();
    const authorCount = new Map<string, number>();
    
    let booksWithGenres = 0;

    readings.forEach((reading) => {
      // Count genres
      if (reading.book.genres && reading.book.genres.length > 0) {
        booksWithGenres++;
        reading.book.genres.forEach((genre) => {
          genreCount.set(genre, (genreCount.get(genre) || 0) + 1);
        });
      }

      // Count authors
      if (reading.book.author) {
        const author = reading.book.author;
        authorCount.set(author, (authorCount.get(author) || 0) + 1);
      }
    });

    console.log(`Stats: ${readings.length} readings, ${booksWithGenres} have genres.`);

    const topGenres = Array.from(genreCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const topAuthors = Array.from(authorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const ratedBooks = readings.filter((r) => r.rating);
    
    // Get or generate reader profile
    let readerProfile = null;
    if (userId) {
      readerProfile = await this.getReaderProfile(userId, readings);
    }

    return {
      source,
      totalBooksRead: readings.length,
      booksRated: ratedBooks.length,
      averageRating:
        ratedBooks.reduce((sum, r) => sum + (r.rating || 0), 0) / ratedBooks.length || 0,
      topGenres,
      topAuthors,
      readerProfile,
    };
  }

  /**
   * Generate reader profile for a user
   */
  async getReaderProfile(userId: number, readings: UserReading[]) {
    const { DatabaseService } = await import('./database.js');
    const existing = DatabaseService.getReaderProfile(userId);
    
    // If profile exists and data hasn't changed significantly, return it
    // We check if reading count has changed
    if (existing.profile && existing.readingsCount === readings.length) {
      try {
        return JSON.parse(existing.profile);
      } catch (e) {
        console.error('Error parsing existing profile:', e);
      }
    }
    
    // Generate new profile
    console.log('Generating new reader profile...');
    try {
      const profile = await this.aiService.generateReaderProfile(readings);
      DatabaseService.updateReaderProfile(userId, JSON.stringify(profile), readings.length);
      return profile;
    } catch (error) {
      console.error('Error generating reader profile:', error);
      return existing.profile ? JSON.parse(existing.profile) : null;
    }
  }

  /**
   * Format and display recommendations
   */
  static formatRecommendations(recommendations: Recommendation[]): string {
    if (recommendations.length === 0) {
      return 'No recommendations found.';
    }

    let output = '';
    recommendations.forEach((rec, index) => {
      output += `\n${index + 1}. "${rec.title}" by ${rec.author}\n`;
      output += `   ${rec.reasoning}\n`;
    });

    return output;
  }

  /**
   * Format and display reading analysis
   */
  static formatReadingAnalysis(analysis: ReadingAnalysis): string {
    let output = '\n=== READING PATTERNS ===\n';
    analysis.patterns.forEach((pattern, index) => {
      output += `${index + 1}. ${pattern}\n`;
    });

    output += '\n=== BLIND SPOTS & RECOMMENDATIONS ===\n';
    analysis.blindSpots.forEach((blindSpot, index) => {
      output += `\n${index + 1}. ${blindSpot.category}\n`;
      output += `   ${blindSpot.description}\n`;
      output += '\n   Recommended books to address this gap:\n';
      blindSpot.recommendations.forEach((rec, recIndex) => {
        output += `   ${recIndex + 1}. "${rec.title}" by ${rec.author}\n`;
        output += `      ${rec.reasoning}\n`;
      });
    });

    output += '\n=== SUGGESTED TOPICS TO EXPLORE ===\n';
    analysis.suggestedTopics.forEach((topic, index) => {
      output += `${index + 1}. ${topic}\n`;
    });

    return output;
  }

  private hasBookLoreCredentials(): boolean {
    return !!this.bookloreClient;
  }

  private hasGoodreadsReadings(): boolean {
    return !!(this.guestReadings && this.guestReadings.length > 0);
  }

  private hasHardcoverCredentials(): boolean {
    return !!this.hardcoverClient;
  }

  private determineDataSource(): 'booklore' | 'goodreads' | 'hardcover' {
    const hasBookLore = this.hasBookLoreCredentials();
    const hasGoodreads = this.hasGoodreadsReadings();
    const hasHardcover = this.hasHardcoverCredentials();
    const preference = this.dataSourcePreference || 'auto';

    if (preference === 'booklore') {
      if (hasBookLore) return 'booklore';
      if (hasGoodreads) return 'goodreads';
      if (hasHardcover) return 'hardcover';
    } else if (preference === 'goodreads') {
      if (hasGoodreads) return 'goodreads';
      if (hasBookLore) return 'booklore';
      if (hasHardcover) return 'hardcover';
    } else if (preference === 'hardcover') {
      if (hasHardcover) return 'hardcover';
      if (hasBookLore) return 'booklore';
      if (hasGoodreads) return 'goodreads';
    } else {
      // auto: prioritize Hardcover > Goodreads > BookLore
      if (hasHardcover) return 'hardcover';
      if (hasGoodreads) return 'goodreads';
      if (hasBookLore) return 'booklore';
    }

    throw new Error('No reading history configured. Please connect a data source (BookLore, Hardcover, or Goodreads).');
  }

  private async getReadingsForSource(source: 'booklore' | 'goodreads' | 'hardcover'): Promise<UserReading[]> {
    if (source === 'booklore') {
      if (!this.bookloreClient) {
        throw new Error('BookLore credentials not configured.');
      }
      const readings = await this.bookloreClient.getUserReadingHistory();
      if (!readings || readings.length === 0) {
        throw new Error('No reading history found in BookLore. Please read and rate some books first.');
      }
      return readings;
    }

    if (source === 'hardcover') {
      if (!this.hardcoverClient) {
        throw new Error('Hardcover API key not configured.');
      }
      const readings = await this.hardcoverClient.getUserReadingHistory();
      if (!readings || readings.length === 0) {
        throw new Error('No reading history found in Hardcover. Please mark some books as read first.');
      }
      return readings;
    }

    if (!this.guestReadings || this.guestReadings.length === 0) {
      throw new Error('No Goodreads data available. Please upload your Goodreads CSV file.');
    }

    return this.guestReadings;
  }

  /**
   * Enrich recommendations with cover images from Hardcover
   */
  private async enrichWithCovers(recommendations: Recommendation[]): Promise<Recommendation[]> {
    // Use global Hardcover client for book metadata searches
    if (!this.globalHardcoverClient) {
      return recommendations;
    }

    console.log('Fetching cover images for recommendations...');
    const enriched = await Promise.all(
      recommendations.map(async (rec) => {
        try {
          const book = await this.globalHardcoverClient!.getBookDetails(rec.title, rec.author);
          if (book && book.images && book.images.length > 0) {
            return { ...rec, coverUrl: book.images[0].url };
          }
        } catch (error) {
          console.error(`Failed to fetch cover for ${rec.title}:`, error);
        }
        return rec;
      })
    );

    return enriched;
  }
}
