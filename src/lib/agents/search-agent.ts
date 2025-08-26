import { BaseAgent, AgentMessage, AgentCapabilities } from './base-agent';
import ZAI from 'z-ai-web-dev-sdk';

export interface SearchQuery {
  query: string;
  searchType: 'web' | 'vector' | 'hybrid';
  filters?: Record<string, any>;
  maxResults?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  relevanceScore: number;
  sourceType: string;
  metadata?: any;
}

export class SearchAgent extends BaseAgent {
  private zai: ZAI | null = null;
  private searchStats: {
    totalSearches: number;
    successfulSearches: number;
    failedSearches: number;
    averageResponseTime: number;
  };

  constructor(id: string) {
    const capabilities: AgentCapabilities = {
      search: true,
      processing: false,
      safety: false,
      specialized: ['web-search', 'vector-search', 'hybrid-search']
    };

    super(id, 'search-agent', capabilities);
    
    this.searchStats = {
      totalSearches: 0,
      successfulSearches: 0,
      failedSearches: 0,
      averageResponseTime: 0
    };
  }

  async initialize(): Promise<void> {
    try {
      this.zai = await ZAI.create();
      this.setStatus('idle');
      this.log('Search agent initialized successfully');
    } catch (error) {
      this.log(`Failed to initialize: ${error}`, 'error');
      this.setStatus('error');
      throw error;
    }
  }

  async processMessage(message: AgentMessage): Promise<any> {
    this.setStatus('busy');
    const startTime = Date.now();

    try {
      switch (message.type) {
        case 'search':
          return await this.handleSearch(message.payload);
        case 'web-search':
          return await this.handleWebSearch(message.payload);
        case 'vector-search':
          return await this.handleVectorSearch(message.payload);
        case 'get-stats':
          return this.searchStats;
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.log(`Error processing message: ${error}`, 'error');
      this.searchStats.failedSearches++;
      throw error;
    } finally {
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      this.setStatus('idle');
    }
  }

  private async handleSearch(payload: SearchQuery): Promise<SearchResult[]> {
    if (!this.validatePayload(payload, ['query', 'searchType'])) {
      throw new Error('Invalid search payload');
    }

    this.searchStats.totalSearches++;
    this.log(`Executing ${payload.searchType} search for: "${payload.query}"`);

    switch (payload.searchType) {
      case 'web':
        return await this.handleWebSearch(payload);
      case 'vector':
        return await this.handleVectorSearch(payload);
      case 'hybrid':
        return await this.handleHybridSearch(payload);
      default:
        throw new Error(`Unknown search type: ${payload.searchType}`);
    }
  }

  private async handleWebSearch(payload: SearchQuery): Promise<SearchResult[]> {
    if (!this.zai) {
      throw new Error('ZAI not initialized');
    }

    try {
      const results = await this.zai.functions.invoke("web_search", {
        query: payload.query,
        num: payload.maxResults || 10
      });

      if (!Array.isArray(results)) {
        throw new Error('Invalid search results format');
      }

      const searchResults: SearchResult[] = results.map((result: any, index: number) => ({
        id: `web_${Date.now()}_${index}`,
        title: result.name || `Web Result ${index + 1}`,
        url: result.url || '',
        snippet: result.snippet || '',
        relevanceScore: this.calculateRelevanceScore(result, index),
        sourceType: 'web',
        metadata: {
          host_name: result.host_name,
          date: result.date,
          rank: result.rank || index
        }
      }));

      this.searchStats.successfulSearches++;
      this.log(`Web search completed with ${searchResults.length} results`);
      return searchResults;

    } catch (error) {
      this.log(`Web search failed: ${error}`, 'error');
      throw error;
    }
  }

  private async handleVectorSearch(payload: SearchQuery): Promise<SearchResult[]> {
    // Import vector store dynamically to avoid circular dependencies
    const { vectorStore, embeddingGenerator } = await import('@/lib/rag/vector-store');

    try {
      // Generate query embedding
      const queryEmbedding = await embeddingGenerator.generateEmbedding(payload.query);
      
      // Perform similarity search
      const vectorResults = await vectorStore.similaritySearch(
        queryEmbedding,
        payload.maxResults || 5,
        payload.filters
      );

      const searchResults: SearchResult[] = vectorResults.map((result: any, index: number) => ({
        id: `vector_${result.id}`,
        title: result.metadata.title || 'Document',
        url: result.metadata.url || '',
        snippet: result.content.substring(0, 200) + '...',
        relevanceScore: result.score,
        sourceType: 'vector',
        metadata: result.metadata
      }));

      this.searchStats.successfulSearches++;
      this.log(`Vector search completed with ${searchResults.length} results`);
      return searchResults;

    } catch (error) {
      this.log(`Vector search failed: ${error}`, 'error');
      throw error;
    }
  }

  private async handleHybridSearch(payload: SearchQuery): Promise<SearchResult[]> {
    try {
      // Execute both web and vector searches in parallel
      const [webResults, vectorResults] = await Promise.allSettled([
        this.handleWebSearch({ ...payload, maxResults: Math.floor((payload.maxResults || 10) / 2) }),
        this.handleVectorSearch({ ...payload, maxResults: Math.ceil((payload.maxResults || 10) / 2) })
      ]);

      const results: SearchResult[] = [];
      
      if (webResults.status === 'fulfilled') {
        results.push(...webResults.value);
      } else {
        this.log(`Web search in hybrid failed: ${webResults.reason}`, 'warn');
      }

      if (vectorResults.status === 'fulfilled') {
        results.push(...vectorResults.value);
      } else {
        this.log(`Vector search in hybrid failed: ${vectorResults.reason}`, 'warn');
      }

      // Sort by relevance score and return top results
      const sortedResults = results
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, payload.maxResults || 10);

      this.searchStats.successfulSearches++;
      this.log(`Hybrid search completed with ${sortedResults.length} results`);
      return sortedResults;

    } catch (error) {
      this.log(`Hybrid search failed: ${error}`, 'error');
      throw error;
    }
  }

  private calculateRelevanceScore(result: any, rank: number): number {
    let score = 1.0;
    
    // Reduce score based on rank
    score -= (rank * 0.1);
    
    // Boost score for certain factors
    if (result.host_name && result.host_name.includes('wikipedia')) {
      score += 0.1;
    }
    
    if (result.date && this.isRecent(result.date)) {
      score += 0.05;
    }
    
    return Math.max(0.1, Math.min(1.0, score));
  }

  private isRecent(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30; // Consider recent if within 30 days
    } catch {
      return false;
    }
  }

  private updateAverageResponseTime(responseTime: number): void {
    const total = this.searchStats.totalSearches;
    if (total === 0) {
      this.searchStats.averageResponseTime = responseTime;
    } else {
      this.searchStats.averageResponseTime = 
        (this.searchStats.averageResponseTime * (total - 1) + responseTime) / total;
    }
  }

  async shutdown(): Promise<void> {
    this.log('Shutting down search agent');
    this.setStatus('idle');
    this.zai = null;
  }
}