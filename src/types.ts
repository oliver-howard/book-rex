import { z } from 'zod';

// BookLore API Types
export const BookSchema = z.object({
  id: z.number(),
  title: z.string(),
  author: z.string().optional(),
  description: z.string().optional(),
  genres: z.array(z.string()).optional(),
  isbn: z.string().optional(),
  publishedDate: z.string().optional(),
  coverImageUrl: z.string().optional(),
});

export const UserReadingSchema = z.object({
  bookId: z.number(),
  book: BookSchema,
  rating: z.number().min(1).max(5).optional(),
  status: z.enum(['want_to_read', 'reading', 'read']).optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  review: z.string().optional(),
  notes: z.string().optional(),
});

export const UserProfileSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().optional(),
  favoriteGenres: z.array(z.string()).optional(),
  favoriteAuthors: z.array(z.string()).optional(),
});

export type Book = z.infer<typeof BookSchema>;
export type UserReading = z.infer<typeof UserReadingSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;

// AI Recommendation Types
export const RecommendationSchema = z.object({
  title: z.string(),
  author: z.string(),
  reasoning: z.string(),
  estimatedMatch: z.number().min(0).max(100).optional(),
  amazonUrl: z.string().optional(), // Amazon search/purchase link
  coverUrl: z.string().optional(),
});

export const BlindSpotSchema = z.object({
  category: z.string(),
  description: z.string(),
  recommendations: z.array(RecommendationSchema),
});

export const ReadingAnalysisSchema = z.object({
  blindSpots: z.array(BlindSpotSchema),
  patterns: z.array(z.string()),
  suggestedTopics: z.array(z.string()),
});

export type Recommendation = z.infer<typeof RecommendationSchema> & {
  details?: HardcoverBook;
};
export type BlindSpot = z.infer<typeof BlindSpotSchema>;
export type ReadingAnalysis = z.infer<typeof ReadingAnalysisSchema>;

export interface HardcoverBook {
  id: number;
  slug?: string;
  title: string;
  description?: string;
  release_date?: string;
  pages?: number;
  images?: Array<{
    url: string;
    width?: number;
    height?: number;
  }>;
  contributions?: Array<{
    author?: {
      name: string;
    };
  }>;
  rating?: number;
  users_count?: number;
  likes_count?: number;
}

// AI Provider Types
export type AIProvider = 'anthropic' | 'openai' | 'google';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  temperature?: number;
}

export type RecommendationType = 'similar' | 'contrasting' | 'blindspots';

export type DataSourcePreference = 'auto' | 'booklore' | 'goodreads' | 'hardcover';

// Progress tracking for SSE
export type ProgressCallback = (stage: string, percent: number, message: string) => void;

// To Be Read (TBR) Types
export interface TBRBook {
  id: string;
  title: string;
  author: string;
  reasoning?: string;
  amazonUrl?: string;
  coverUrl?: string;
  addedAt: string;
}

export interface GuestData {
  readings: UserReading[];
  tbr: TBRBook[];
  exclusions: Array<{
    id: string;
    title: string;
    author: string;
    reasoning?: string;
    coverUrl?: string;
    addedAt: string;
  }>;
  dataSourcePreference: DataSourcePreference;
  hardcoverApiKey?: string;
  bookloreUsername?: string;
  booklorePassword?: string;
}
