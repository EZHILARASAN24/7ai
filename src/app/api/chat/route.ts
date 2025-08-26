import { NextRequest, NextResponse } from "next/server";
import ZAI from 'z-ai-web-dev-sdk';

interface ChatRequest {
  message: string;
  conversation_id?: string;
  context?: string;
  preferences?: {
    response_length?: 'brief' | 'detailed' | 'comprehensive';
    technical_level?: 'basic' | 'intermediate' | 'advanced';
  };
}

interface Citation {
  id: string;
  title: string;
  url: string;
  snippet: string;
  relevance_score: number;
}

interface ChatResponse {
  conversation_id: string;
  response: string;
  citations: Citation[];
  follow_up_suggestions: string[];
  confidence_score: number;
  timestamp: string;
}

// Simple in-memory conversation storage (in production, use a database)
const conversationStore = new Map<string, Array<{role: string, content: string, timestamp: string}>>();

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { 
      message, 
      conversation_id, 
      context = '', 
      preferences = { 
        response_length: 'detailed', 
        technical_level: 'intermediate' 
      } 
    } = body;

    // Validate input
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    
    // Generate or use conversation ID
    const convId = conversation_id || `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize conversation history if new
    if (!conversationStore.has(convId)) {
      conversationStore.set(convId, []);
    }
    
    const conversationHistory = conversationStore.get(convId)!;
    
    // Add user message to history
    conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // Initialize ZAI SDK
    const zai = await ZAI.create();

    // Step 1: Determine if web search is needed
    let searchResults: any[] = [];
    const needsSearch = await determineIfSearchNeeded(message, conversationHistory);
    
    if (needsSearch) {
      try {
        searchResults = await zai.functions.invoke("web_search", {
          query: message,
          num: 5
        });
      } catch (error) {
        console.error('Web search failed:', error);
      }
    }

    // Step 2: Build conversation context
    const systemPrompt = buildSystemPrompt(preferences, searchResults);
    
    // Step 3: Generate response
    let response = '';
    let confidence_score = 0.7;
    let citations: Citation[] = [];

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-10), // Last 10 messages for context
        { role: 'user', content: message }
      ];

      const completion = await zai.chat.completions.create({
        messages: messages as any,
        temperature: 0.3,
        max_tokens: 1500
      });

      response = completion.choices[0]?.message?.content || 'I apologize, but I encountered an issue generating a response.';
      
      // Extract citations from search results if used
      if (searchResults && Array.isArray(searchResults)) {
        citations = searchResults.map((result: any, index: number) => ({
          id: `cite_${index + 1}`,
          title: result.name || `Source ${index + 1}`,
          url: result.url || '',
          snippet: result.snippet || '',
          relevance_score: 1 - (result.rank || index) / 10
        }));
        
        confidence_score = Math.min(0.95, 0.6 + (searchResults.length * 0.07));
      }

    } catch (error) {
      console.error('AI response generation failed:', error);
      response = 'I apologize, but I encountered an error while processing your message. Please try again.';
      confidence_score = 0.3;
    }

    // Step 4: Generate follow-up suggestions
    const followUpSuggestions = await generateFollowUpSuggestions(message, response, zai);

    // Add assistant response to history
    conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });

    // Keep only last 50 messages to prevent memory issues
    if (conversationHistory.length > 50) {
      conversationStore.set(convId, conversationHistory.slice(-50));
    }

    const chatResponse: ChatResponse = {
      conversation_id: convId,
      response,
      citations,
      follow_up_suggestions,
      confidence_score,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(chatResponse);

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function determineIfSearchNeeded(message: string, history: Array<{role: string, content: string}>): Promise<boolean> {
  const zai = await ZAI.create();
  
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that determines if a user's message requires web search for current information.
          Respond with only "yes" or "no" based on whether the message asks for:
          - Current events, news, or recent developments
          - Specific facts, statistics, or data
          - Information that might change over time
          - External references or sources`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.1,
      max_tokens: 10
    });

    const response = completion.choices[0]?.message?.content?.toLowerCase().trim();
    return response === 'yes';
  } catch (error) {
    console.error('Search determination failed:', error);
    return false; // Default to no search on error
  }
}

function buildSystemPrompt(preferences: any, searchResults: any[]): string {
  let prompt = `You are a helpful AI assistant engaged in a conversation. `;
  
  // Add preferences
  if (preferences.response_length === 'brief') {
    prompt += 'Provide concise, brief responses. ';
  } else if (preferences.response_length === 'comprehensive') {
    prompt += 'Provide detailed, comprehensive responses with thorough explanations. ';
  } else {
    prompt += 'Provide detailed but balanced responses. ';
  }

  if (preferences.technical_level === 'basic') {
    prompt += 'Explain concepts in simple, easy-to-understand terms. ';
  } else if (preferences.technical_level === 'advanced') {
    prompt += 'Use technical terminology and provide in-depth analysis. ';
  } else {
    prompt += 'Use appropriate technical language with clear explanations. ';
  }

  // Add search context if available
  if (searchResults && searchResults.length > 0) {
    prompt += `\n\nRecent search results for context:\n`;
    searchResults.forEach((result: any, index: number) => {
      prompt += `Source ${index + 1}: ${result.snippet}\n`;
    });
    prompt += '\nUse these search results to inform your response and cite sources when relevant.';
  }

  prompt += '\n\nBe helpful, accurate, and engaging. Maintain context from the conversation history.';

  return prompt;
}

async function generateFollowUpSuggestions(message: string, response: string, zai: any): Promise<string[]> {
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Generate 3 follow-up questions or suggestions based on the user's message and your response.
          These should be natural, relevant questions that the user might want to explore next.
          Return only the questions, one per line, without numbering.`
        },
        {
          role: 'user',
          content: `User message: ${message}\n\nAssistant response: ${response}`
        }
      ],
      temperature: 0.5,
      max_tokens: 200
    });

    const suggestionsText = completion.choices[0]?.message?.content || '';
    return suggestionsText.split('\n').filter(s => s.trim().length > 0).slice(0, 3);
  } catch (error) {
    console.error('Follow-up generation failed:', error);
    return [
      'Can you tell me more about this topic?',
      'What are the practical applications?',
      'How does this relate to current trends?'
    ];
  }
}