import { db } from '@/lib/db';

// Simple in-memory vector store for demonstration
// In production, this would use Qdrant, Milvus, or similar
interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    title: string;
    url: string;
    source_type: string;
    created_at: string;
    [key: string]: any;
  };
}

class VectorStore {
  private documents: Map<string, VectorDocument> = new Map();
  private dimension: number = 1536; // Default embedding dimension

  constructor(dimension: number = 1536) {
    this.dimension = dimension;
  }

  async addDocument(doc: {
    id: string;
    content: string;
    embedding: number[];
    metadata: any;
  }): Promise<void> {
    const vectorDoc: VectorDocument = {
      id: doc.id,
      content: doc.content,
      embedding: doc.embedding,
      metadata: {
        title: doc.metadata.title || 'Untitled',
        url: doc.metadata.url || '',
        source_type: doc.metadata.source_type || 'document',
        created_at: new Date().toISOString(),
        ...doc.metadata
      }
    };

    this.documents.set(doc.id, vectorDoc);
  }

  async similaritySearch(
    queryEmbedding: number[],
    limit: number = 5,
    filters?: Record<string, any>
  ): Promise<Array<VectorDocument & { score: number }>> {
    const results: Array<VectorDocument & { score: number }> = [];

    for (const doc of this.documents.values()) {
      // Apply filters if provided
      if (filters) {
        let matchesFilters = true;
        for (const [key, value] of Object.entries(filters)) {
          if (doc.metadata[key] !== value) {
            matchesFilters = false;
            break;
          }
        }
        if (!matchesFilters) continue;
      }

      // Calculate cosine similarity
      const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
      results.push({ ...doc, score });
    }

    // Sort by score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  async clear(): Promise<void> {
    this.documents.clear();
  }

  async getDocument(id: string): Promise<VectorDocument | undefined> {
    return this.documents.get(id);
  }

  async getAllDocuments(): Promise<VectorDocument[]> {
    return Array.from(this.documents.values());
  }

  async getStats(): Promise<{
    totalDocuments: number;
    dimension: number;
    memoryUsage: number;
  }> {
    return {
      totalDocuments: this.documents.size,
      dimension: this.dimension,
      memoryUsage: process.memoryUsage ? process.memoryUsage().heapUsed : 0
    };
  }
}

// Singleton instance
export const vectorStore = new VectorStore();

// Mock embedding generator - in production, use OpenAI, Cohere, or similar
export class MockEmbeddingGenerator {
  async generateEmbedding(text: string): Promise<number[]> {
    // Generate deterministic mock embeddings based on text hash
    const hash = this.simpleHash(text);
    const embedding: number[] = [];
    
    for (let i = 0; i < 1536; i++) {
      // Generate pseudo-random but deterministic values
      const seed = hash + i;
      const value = Math.sin(seed) * 0.5 + 0.5; // Normalize to [0, 1]
      embedding.push(value);
    }
    
    return embedding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

export const embeddingGenerator = new MockEmbeddingGenerator();