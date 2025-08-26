import { NextRequest, NextResponse } from "next/server";
import ZAI from 'z-ai-web-dev-sdk';

interface SearchRequest {
  query: string;
  search_type?: 'hybrid' | 'web' | 'vector';
  filters?: {
    date_range?: { start: string; end: string };
    sources?: string[];
    language?: string;
  };
  max_results?: number;
  include_citations?: boolean;
}

interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  relevance_score: number;
  source_type: string;
  published_date?: string;
}

interface Citation {
  id: string;
  title: string;
  url: string;
  snippet: string;
  relevance_score: number;
}

interface SearchResponse {
  query_id: string;
  response: string;
  citations: Citation[];
  sources: SearchResult[];
  confidence_score: number;
  processing_time: number;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();
    const { query, search_type = 'hybrid', filters = {}, max_results = 10, include_citations = true } = body;

    // Validate input
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const query_id = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize ZAI SDK
    const zai = await ZAI.create();

    // Step 1: Perform web search
    let searchResults: SearchResult[] = [];
    try {
      const webSearchResults = await zai.functions.invoke("web_search", {
        query: query,
        num: max_results
      });

      if (webSearchResults && Array.isArray(webSearchResults)) {
        searchResults = webSearchResults.map((result: any, index: number) => ({
          id: `source_${index + 1}`,
          title: result.name || `Source ${index + 1}`,
          url: result.url || '',
          snippet: result.snippet || '',
          relevance_score: 1 - (result.rank || index) / 10, // Higher rank = higher score
          source_type: result.host_name || 'web',
          published_date: result.date || undefined
        }));
      }
    } catch (error) {
      console.error('Web search failed:', error);
    }

    // Step 2: Generate comprehensive response using AI
    let response = '';
    let confidence_score = 0.5;

    if (searchResults.length > 0) {
      // Create context from search results
      const context = searchResults.map((result, index) => 
        `Source ${index + 1}: ${result.snippet}\nURL: ${result.url}\n`
      ).join('\n');

      try {
        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are a helpful AI assistant that provides comprehensive, accurate answers based on search results. 
              Use the provided search results to formulate your response. Always cite your sources using [Source X] notation.
              Be thorough, accurate, and provide a well-structured answer.`
            },
            {
              role: 'user',
              content: `Query: ${query}\n\nSearch Results:\n${context}\n\nPlease provide a comprehensive answer to the query based on these search results.`
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        });

        response = completion.choices[0]?.message?.content || 'Unable to generate response';
        confidence_score = Math.min(0.9, 0.5 + (searchResults.length * 0.05));
      } catch (error) {
        console.error('AI response generation failed:', error);
        response = 'I found some relevant information, but encountered an issue generating a comprehensive response.';
      }
    } else {
      response = 'I apologize, but I couldn\'t find any relevant information for your query. Please try rephrasing your question or search terms.';
      confidence_score = 0.2;
    }

    // Step 3: Extract citations
    const citations: Citation[] = include_citations ? searchResults.map((result, index) => ({
      id: `cite_${index + 1}`,
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      relevance_score: result.relevance_score
    })) : [];

    const processingTime = Date.now() - startTime;

    const searchResponse: SearchResponse = {
      query_id,
      response,
      citations,
      sources: searchResults,
      confidence_score,
      processing_time: processingTime / 1000,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(searchResponse);

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}