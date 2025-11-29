import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIConfig, AIProvider, Recommendation, ReadingAnalysis, UserReading, TBRBook, ProgressCallback } from './types.js';
import { config } from './config.js';
import { getAmazonAffiliateLink, getAmazonSearchUrl } from './utils.js';

export class AIService {
  private provider: AIProvider;
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private google?: GoogleGenerativeAI;
  private model: string;
  private temperature: number;

  constructor(aiConfig?: Partial<AIConfig>) {
    this.provider = aiConfig?.provider || config.ai.defaultProvider;
    this.temperature = aiConfig?.temperature || config.ai.temperature;

    // Initialize the appropriate AI client
    switch (this.provider) {
      case 'anthropic':
        this.anthropic = new Anthropic({
          apiKey: aiConfig?.apiKey || config.ai.anthropic.apiKey,
        });
        this.model = aiConfig?.model || config.ai.anthropic.model;
        break;
      case 'openai':
        this.openai = new OpenAI({
          apiKey: aiConfig?.apiKey || config.ai.openai.apiKey,
        });
        this.model = aiConfig?.model || config.ai.openai.model;
        break;
      case 'google':
        this.google = new GoogleGenerativeAI(
          aiConfig?.apiKey || config.ai.google.apiKey
        );
        this.model = aiConfig?.model || config.ai.google.model;
        break;
      default:
        throw new Error(`Unsupported AI provider: ${this.provider}`);
    }
  }

  /**
   * Generate completion using the configured AI provider
   */
  private async generateCompletion(
    systemMessage: string,
    userMessage: string
  ): Promise<string> {
    switch (this.provider) {
      case 'anthropic':
        return this.generateAnthropicCompletion(systemMessage, userMessage);
      case 'openai':
        return this.generateOpenAICompletion(systemMessage, userMessage);
      case 'google':
        return this.generateGoogleCompletion(systemMessage, userMessage);
      default:
        throw new Error(`Unsupported AI provider: ${this.provider}`);
    }
  }

  private async generateAnthropicCompletion(
    systemMessage: string,
    userMessage: string
  ): Promise<string> {
    if (!this.anthropic) throw new Error('Anthropic client not initialized');

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      temperature: this.temperature,
      system: systemMessage,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    throw new Error('Unexpected response format from Anthropic');
  }

  private async generateOpenAICompletion(
    systemMessage: string,
    userMessage: string
  ): Promise<string> {
    if (!this.openai) throw new Error('OpenAI client not initialized');

    const response = await this.openai.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      messages: [
        {
          role: 'system',
          content: systemMessage,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    return response.choices[0]?.message?.content || '';
  }

  private async generateGoogleCompletion(
    systemMessage: string,
    userMessage: string
  ): Promise<string> {
    if (!this.google) throw new Error('Google client not initialized');

    const model = this.google.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: this.temperature,
      },
    });

    const prompt = `${systemMessage}\n\n${userMessage}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  /**
   * Clean and parse JSON response from AI
   * Based on Unearthed implementation
   */
  private cleanAndParseJSON<T>(text: string): T {
    // Remove markdown code blocks
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Remove special characters that often cause issues
    cleaned = cleaned.replace(/[\u2013\u2014]/g, '-'); // em dashes
    cleaned = cleaned.replace(/[\u2018\u2019]/g, "'"); // smart quotes
    cleaned = cleaned.replace(/[\u201C\u201D]/g, '"'); // smart double quotes

    try {
      return JSON.parse(cleaned);
    } catch (error) {
      // Attempt to extract JSON if it's embedded in other text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error(`Failed to parse AI response as JSON: ${error}`);
    }
  }

  /**
   * Format user's reading history for AI context (detailed)
   */
  private formatReadingHistory(readings: UserReading[]): string {
    // Optimize: Limit to most recent 100 books for detailed context
    const recentReadings = readings.slice(-100);
    
    return recentReadings
      .map((reading) => {
        const { book, rating, review, notes } = reading;
        let entry = `"${book.title}" by ${book.author || 'Unknown'}`;

        if (rating) {
          entry += ` (Rating: ${rating}/10)`;
        }

        if (book.genres && book.genres.length > 0) {
          entry += ` [${book.genres.join(', ')}]`;
        }

        if (notes) {
          entry += `\n  Notes: ${notes}`;
        }

        if (review) {
          entry += `\n  Review: ${review}`;
        }

        return entry;
      })
      .join('\n');
  }

  /**
   * Format exclusion list of ALL books user has read (simple title + author)
   * This is used to prevent the AI from recommending books already in their library
   */
  private formatExclusionList(readings: UserReading[]): string {
    if (readings.length === 0) {
      return 'None';
    }

    // Create a simple list of "Title" by Author for all books
    const bookList = readings
      .map((reading) => `"${reading.book.title}" by ${reading.book.author || 'Unknown'}`)
      .join(', ');

    return bookList;
  }

  /**
   * Add Amazon search URLs to recommendations
   */
  private addAmazonLinks(recommendations: Recommendation[]): Recommendation[] {
    return recommendations.map((rec) => ({
      ...rec,
      amazonUrl: getAmazonAffiliateLink(rec.title, rec.author),
    }));
  }

  private formatTBRList(tbrBooks?: TBRBook[]): string {
    if (!tbrBooks || tbrBooks.length === 0) {
      return 'They currently have no books in their TBR list.';
    }

    return tbrBooks
      .map((book) => `- "${book.title}" by ${book.author || 'Unknown'}`)
      .join('\n');
  }

  /**
   * Get similar book recommendations
   */
  async getSimilarRecommendations(
    userReadings: UserReading[],
    tbrBooks: TBRBook[] = [],
    maxRecommendations = 5,
    onProgress?: ProgressCallback
  ): Promise<Recommendation[]> {
    const systemMessage = `You are a book recommendation expert. Based on the user's reading history with their ratings, notes, and reviews, suggest similar books that they might enjoy. Address the user directly as "you". Consider the themes, writing style, genres, and subject matter. Pay special attention to highly-rated books, user notes (which reveal what they liked/disliked), and reviews.

Return your response as a JSON array of recommendations with this exact structure:
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "reasoning": "Why you think the user will enjoy this book based on their reading history. Use 'you' to address the user."
  }
]

Important:
- Return ONLY the JSON array, no additional text
- Use plain text only (no markdown, no special characters, no em dashes)
- Provide exactly ${maxRecommendations} recommendations
- Do not recommend books already in the user's reading history or currently on their TBR list`;

    onProgress?.('preparing', 20, 'Preparing recommendation prompt...');
    
    const exclusionList = this.formatExclusionList(userReadings);
    const tbrSection = this.formatTBRList(tbrBooks);
    const userMessage = `Here is the user's detailed reading history (most recent ${Math.min(100, userReadings.length)} books):\n\n${this.formatReadingHistory(userReadings)}\n\nBooks the user has ALREADY READ (never recommend these - ${userReadings.length} total):\n${exclusionList}\n\nBooks already on their TBR list (avoid recommending these):\n${tbrSection}`;

    onProgress?.('analyzing', 60, 'AI is analyzing your reading patterns...');
    const response = await this.generateCompletion(systemMessage, userMessage);
    
    onProgress?.('finalizing', 90, 'Finalizing recommendations...');
    const recommendations = this.cleanAndParseJSON<Recommendation[]>(response);
    return this.addAmazonLinks(recommendations);
  }

  /**
   * Get contrasting book recommendations (opposing viewpoints)
   */
  async getContrastingRecommendations(
    userReadings: UserReading[],
    tbrBooks: TBRBook[] = [],
    maxRecommendations = 5,
    onProgress?: ProgressCallback
  ): Promise<Recommendation[]> {
    const systemMessage = `You are a book recommendation expert specializing in diverse perspectives. Based on the user's reading history with their ratings, notes, and reviews, suggest books that present contrasting perspectives, challenge their current assumptions, or offer opposing ideologies and viewpoints. Address the user directly as "you". Pay attention to their notes and reviews to understand their current worldview.

The goal is to help the user explore different perspectives and avoid echo chambers.

Return your response as a JSON array of recommendations with this exact structure:
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "reasoning": "How this book offers a contrasting perspective to the user's reading history. Use 'you' to address the user."
  }
]

Important:
- Return ONLY the JSON array, no additional text
- Use plain text only (no markdown, no special characters, no em dashes)
- Provide exactly ${maxRecommendations} recommendations
- Do not recommend books already in the user's reading history or currently in their TBR list
- Focus on intellectual opposition and alternative frameworks`;

    onProgress?.('preparing', 20, 'Preparing recommendation prompt...');
    
    const exclusionList = this.formatExclusionList(userReadings);
    const tbrSection = this.formatTBRList(tbrBooks);
    const userMessage = `Here is the user's detailed reading history (most recent ${Math.min(100, userReadings.length)} books):\n\n${this.formatReadingHistory(userReadings)}\n\nBooks the user has ALREADY READ (never recommend these - ${userReadings.length} total):\n${exclusionList}\n\nBooks already on their TBR list (avoid recommending these):\n${tbrSection}`;

    onProgress?.('analyzing', 60, 'AI is finding contrasting perspectives...');
    const response = await this.generateCompletion(systemMessage, userMessage);
    
    onProgress?.('finalizing', 90, 'Finalizing recommendations...');
    const recommendations = this.cleanAndParseJSON<Recommendation[]>(response);
    return this.addAmazonLinks(recommendations);
  }

  /**
   * Analyze reading blind spots
   */
  async analyzeReadingBlindSpots(
    userReadings: UserReading[],
    onProgress?: ProgressCallback
  ): Promise<ReadingAnalysis> {
    const systemMessage = `You are a reading analyst. Analyze the user's reading history with their ratings, notes, and reviews to identify patterns and potential blind spots in their book selection. Address the user directly as "you". User notes and reviews provide valuable insight into their preferences and biases.

Return your response as JSON with this exact structure:
{
  "blindSpots": [
    {
      "category": "Category name (e.g., 'Geographic diversity', 'Time periods', 'Genre gaps')",
      "description": "Description of the blind spot. Use 'you' to address the user.",
      "recommendations": [
        {
          "title": "Book Title",
          "author": "Author Name",
          "reasoning": "Why this book addresses this blind spot for the user. Use 'you'."
        }
      ]
    }
  ],
  "patterns": ["Pattern 1 (addressing user as 'you')", "Pattern 2", "Pattern 3"],
  "suggestedTopics": ["Topic 1 (addressing user as 'you')", "Topic 2", "Topic 3"]
}

Important:
- Return ONLY the JSON object, no additional text
- Use plain text only (no markdown, no special characters, no em dashes)
- Identify 3-5 blind spots with 2-3 recommendations each
- List 5-7 observable patterns in the user's reading habits
- Suggest 5-7 topics the user might be interested in exploring
- DO NOT recommend any books the user has already read`;

    onProgress?.('preparing', 20, 'Preparing analysis prompt...');
    
    const exclusionList = this.formatExclusionList(userReadings);
    const userMessage = `Analyze this reading history (most recent ${Math.min(100, userReadings.length)} books shown in detail):\n\n${this.formatReadingHistory(userReadings)}\n\nBooks the user has ALREADY READ (never recommend these - ${userReadings.length} total):\n${exclusionList}`;

    onProgress?.('analyzing', 60, 'AI is analyzing your reading patterns...');
    const response = await this.generateCompletion(systemMessage, userMessage);
    
    onProgress?.('finalizing', 90, 'Finalizing blind spots analysis...');
    const analysis = this.cleanAndParseJSON<ReadingAnalysis>(response);

    // Add Amazon links to blind spot recommendations
    analysis.blindSpots = analysis.blindSpots.map((spot) => ({
      ...spot,
      recommendations: this.addAmazonLinks(spot.recommendations),
    }));

    return analysis;
  }

  /**
   * Get personalized recommendations based on specific criteria
   */
  async getPersonalizedRecommendations(
    userReadings: UserReading[],
    criteria: string,
    tbrBooks: TBRBook[] = [],
    maxRecommendations = 5,
    onProgress?: ProgressCallback
  ): Promise<Recommendation[]> {
    const systemMessage = `You are a book recommendation expert. Based on the user's reading history with their ratings, notes, and reviews, and the specific criteria they've provided, suggest books that match their request. Address the user directly as "you". Pay attention to their notes and reviews to understand their preferences.

Return your response as a JSON array of recommendations with this exact structure:
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "reasoning": "Why this book matches the criteria and the user's reading history. Use 'you' to address the user."
  }
]

Important:
- Return ONLY the JSON array, no additional text
- Use plain text only (no markdown, no special characters, no em dashes)
- Provide exactly ${maxRecommendations} recommendations
- Do not recommend books already in the user's reading history or on their TBR list`;

    onProgress?.('preparing', 20, 'Preparing custom recommendation prompt...');
    
    const exclusionList = this.formatExclusionList(userReadings);
    const tbrSection = this.formatTBRList(tbrBooks);
    const userMessage = `User's criteria: ${criteria}\n\nDetailed reading history (most recent ${Math.min(100, userReadings.length)} books):\n\n${this.formatReadingHistory(userReadings)}\n\nBooks the user has ALREADY READ (never recommend these - ${userReadings.length} total):\n${exclusionList}\n\nBooks already on their TBR list (avoid recommending these):\n${tbrSection}`;

    onProgress?.('analyzing', 60, 'AI is generating custom recommendations...');
    const response = await this.generateCompletion(systemMessage, userMessage);
    
    onProgress?.('finalizing', 90, 'Finalizing recommendations...');
    const recommendations = this.cleanAndParseJSON<Recommendation[]>(response);
    return this.addAmazonLinks(recommendations);
  }

  /**
   * Get generic recommendations based only on criteria (no reading history - for guest mode)
   */
  async getGenericRecommendations(
    criteria: string,
    tbrBooks: TBRBook[] = [],
    maxRecommendations = 5
  ): Promise<Recommendation[]> {
    const systemMessage = `You are a book recommendation expert. Based on the specific criteria provided, suggest the best books that match the request. Address the user directly as "you". Focus on highly acclaimed, well-known, and widely recommended books in the relevant category.

Return your response as a JSON array of recommendations with this exact structure:
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "reasoning": "Why this book matches the criteria. Use 'you' to address the user."
  }
]

Important:
- Return ONLY the JSON array, no additional text
- Use plain text only (no markdown, no special characters, no em dashes)
- Provide exactly ${maxRecommendations} recommendations
- Focus on highly-rated, popular, and critically acclaimed books
- Do not recommend books already on the user's TBR list`;

    const tbrSection = this.formatTBRList(tbrBooks);
    const userMessage = `User's criteria: ${criteria}\n\nBooks already on their TBR list (avoid recommending these):\n${tbrSection}`;

    const response = await this.generateCompletion(systemMessage, userMessage);
    const recommendations = this.cleanAndParseJSON<Recommendation[]>(response);
    return this.addAmazonLinks(recommendations);
  }

  /**
   * Generate a fun reader profile
   */
  async generateReaderProfile(
    userReadings: UserReading[]
  ): Promise<{ title: string; summary: string; funFact: string }> {
    const systemMessage = `You are a literary personality profiler. Your job is to analyze a user's reading history and create a fun, insightful "Reader Profile" for them. Address the user directly as "you".
    
    Return your response as a JSON object with this exact structure:
    {
      "title": "A creative, fun title for their reading persona (e.g., 'The Dark Fantasy Connoisseur', 'The Non-Fiction Nomad', 'The Cozy Mystery Detective')",
      "summary": "A 2-3 sentence summary of their reading tastes, favorite tropes, and what they seem to look for in a book. Address the user as 'you'.",
      "funFact": "A fun, specific observation about their habits (e.g., 'You seem to only read books with blue covers', 'You love books published in the 1990s', 'You have a secret soft spot for romance novels')."
    }
    
    Important:
    - Return ONLY the JSON object, no additional text
    - Be creative, witty, and encouraging
    - Use plain text only`;

    const userMessage = `Analyze this reading history:\n\n${this.formatReadingHistory(userReadings)}`;

    const response = await this.generateCompletion(systemMessage, userMessage);
    return this.cleanAndParseJSON<{ title: string; summary: string; funFact: string }>(response);
  }
}
