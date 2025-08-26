import ZAI from 'z-ai-web-dev-sdk';
import { vectorStore, embeddingGenerator } from './vector-store';

interface RAGRequest {
  query: string;
  filters?: Record<string, any>;
  maxResults?: number;
  includeWebSearch?: boolean;
}

interface RAGResult {
  response: string;
  sources: Array<{
    id: string;
    title: string;
    url: string;
    content: string;
    score: number;
    metadata: any;
  }>;
  confidenceScore: number;
  processingTime: number;
}

export class RAGPipeline {
  private zai: ZAI;

  constructor() {
    this.zai = null as any; // Will be initialized when needed
  }

  async initialize(): Promise<void> {
    this.zai = await ZAI.create();
  }

  async processQuery(request: RAGRequest): Promise<RAGResult> {
    const startTime = Date.now();
    
    try {
      if (!this.zai) {
        await this.initialize();
      }

      const { query, filters = {}, maxResults = 5, includeWebSearch = true } = request;

      // Step 1: Generate query embedding
      const queryEmbedding = await embeddingGenerator.generateEmbedding(query);

      // Step 2: Retrieve relevant documents from vector store
      const vectorResults = await vectorStore.similaritySearch(
        queryEmbedding,
        maxResults,
        filters
      );

      // Step 3: Perform web search if enabled and needed
      let webResults: any[] = [];
      if (includeWebSearch && vectorResults.length < 3) {
        try {
          webResults = await this.zai.functions.invoke("web_search", {
            query: query,
            num: 5
          });
        } catch (error) {
          console.error('Web search failed:', error);
        }
      }

      // Step 4: Combine and rank all results
      const allResults = this.combineAndRankResults(vectorResults, webResults);

      // Step 5: Generate response using retrieved context
      const response = await this.generateResponse(query, allResults);

      // Step 6: Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(allResults, response);

      const processingTime = Date.now() - startTime;

      return {
        response,
        sources: allResults,
        confidenceScore,
        processingTime
      };

    } catch (error) {
      console.error('RAG pipeline error:', error);
      throw new Error('Failed to process RAG query');
    }
  }

  private combineAndRankResults(
    vectorResults: any[],
    webResults: any[]
  ): Array<{
    id: string;
    title: string;
    url: string;
    content: string;
    score: number;
    metadata: any;
  }> {
    const combinedResults: any[] = [];

    // Add vector results
    vectorResults.forEach((result, index) => {
      combinedResults.push({
        id: result.id,
        title: result.metadata.title,
        url: result.metadata.url,
        content: result.content,
        score: result.score * 0.8, // Slightly lower weight for vector results
        metadata: result.metadata
      });
    });

    // Add web results
    if (webResults && Array.isArray(webResults)) {
      webResults.forEach((result, index) => {
        combinedResults.push({
          id: `web_${index}`,
          title: result.name || `Web Source ${index + 1}`,
          url: result.url || '',
          content: result.snippet || '',
          score: (1 - (result.rank || index) / 10) * 0.9,
          metadata: {
            source_type: 'web',
            host_name: result.host_name,
            date: result.date
          }
        });
      });
    }

    // Sort by score and return top results
    return combinedResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  private async generateResponse(query: string, context: any[]): Promise<string> {
    if (context.length === 0) {
      return 'I apologize, but I couldn\'t find any relevant information to answer your question. Please try rephrasing your query or provide more context.';
    }

    // Build context string
    const contextString = context.map((doc, index) => 
      `Document ${index + 1}:\nTitle: ${doc.title}\nContent: ${doc.content}\nURL: ${doc.url}\n`
    ).join('\n');

    try {
      const completion = await this.zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI assistant that provides accurate, comprehensive answers based on the provided context.
            Use the documents to formulate your response. Always cite your sources using [Document X] notation.
            If the information in the documents is insufficient or contradictory, acknowledge this limitation.
            Be thorough, accurate, and provide well-structured answers.`
          },
          {
            role: 'user',
            content: `Query: ${query}\n\nContext Documents:\n${contextString}\n\nPlease provide a comprehensive answer to the query based on these documents.`
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      });

      return completion.choices[0]?.message?.content || 'Unable to generate response';
    } catch (error) {
      console.error('Response generation failed:', error);
      return 'I found some relevant information, but encountered an issue generating a comprehensive response.';
    }
  }

  private calculateConfidenceScore(context: any[], response: string): number {
    let score = 0.5; // Base score

    // Increase score based on number of relevant sources
    score += Math.min(0.3, context.length * 0.05);

    // Increase score based on average relevance score
    const avgRelevance = context.reduce((sum, doc) => sum + doc.score, 0) / context.length;
    score += avgRelevance * 0.2;

    // Cap the score at 0.95
    return Math.min(0.95, score);
  }

  async addDocumentToStore(document: {
    id: string;
    content: string;
    metadata: any;
  }): Promise<void> {
    try {
      const embedding = await embeddingGenerator.generateEmbedding(document.content);
      await vectorStore.addDocument({
        id: document.id,
        content: document.content,
        embedding,
        metadata: document.metadata
      });
    } catch (error) {
      console.error('Failed to add document to vector store:', error);
      throw error;
    }
  }

  async getStoreStats(): Promise<any> {
    return await vectorStore.getStats();
  }
}

export const ragPipeline = new RAGPipeline();