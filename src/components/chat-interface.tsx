'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, ExternalLink, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: Array<{
    id: string;
    title: string;
    url: string;
    snippet: string;
    relevance_score: number;
  }>;
}

interface ChatResponse {
  conversation_id: string;
  response: string;
  citations: Array<{
    id: string;
    title: string;
    url: string;
    snippet: string;
    relevance_score: number;
  }>;
  follow_up_suggestions: string[];
  confidence_score: number;
  timestamp: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const [preferences, setPreferences] = useState({
    response_length: 'detailed' as 'brief' | 'detailed' | 'comprehensive',
    technical_level: 'intermediate' as 'basic' | 'intermediate' | 'advanced'
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setFollowUpSuggestions([]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          conversation_id: conversationId || undefined,
          preferences
        }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const data: ChatResponse = await response.json();

      // Update conversation ID if new
      if (!conversationId) {
        setConversationId(data.conversation_id);
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: data.timestamp,
        citations: data.citations
      };

      setMessages(prev => [...prev, assistantMessage]);
      setFollowUpSuggestions(data.follow_up_suggestions);

    } catch (error) {
      toast({
        title: "Chat Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSendMessage(inputMessage);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage(suggestion);
    handleSendMessage(suggestion);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Text copied to clipboard",
    });
  };

  const formatMessage = (message: string, citations?: ChatMessage['citations']) => {
    let formatted = message;
    
    // Convert URLs to links
    formatted = formatted.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>'
    );

    // Add citation references
    if (citations && citations.length > 0) {
      citations.forEach((citation, index) => {
        const citationRegex = new RegExp(`\\[${index + 1}\\]`, 'g');
        formatted = formatted.replace(citationRegex, 
          `<sup class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200" title="${citation.title}" onclick="window.open('${citation.url}', '_blank')">${index + 1}</sup>`
        );
      });
    }

    return formatted;
  };

  const clearConversation = () => {
    setMessages([]);
    setConversationId('');
    setFollowUpSuggestions([]);
    toast({
      title: "Conversation Cleared",
      description: "Started a new conversation",
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">AI Assistant</h1>
        <p className="text-muted-foreground">
          Chat with an AI assistant that can search the web and provide comprehensive answers
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Panel */}
        <div className="lg:col-span-3">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Conversation</CardTitle>
                <div className="flex items-center gap-2">
                  {conversationId && (
                    <Badge variant="outline" className="text-xs">
                      ID: {conversationId.slice(0, 8)}...
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearConversation}
                    disabled={messages.length === 0}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>
                {messages.length === 0 ? "Start a conversation" : `${messages.length} messages`}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center py-8">
                      <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium mb-2">Start a Conversation</h3>
                      <p className="text-muted-foreground">
                        Ask me anything and I'll search the web to provide you with comprehensive answers.
                      </p>
                    </div>
                  )}

                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-blue-600" />
                          </div>
                        </div>
                      )}
                      
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div
                              className={`prose prose-sm max-w-none ${
                                message.role === 'user' ? 'prose-invert' : ''
                              }`}
                              dangerouslySetInnerHTML={{
                                __html: formatMessage(message.content, message.citations)
                              }}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 hover:opacity-100 transition-opacity"
                            onClick={() => copyToClipboard(message.content)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        {message.citations && message.citations.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="text-xs text-muted-foreground mb-2">Sources:</div>
                            <div className="space-y-1">
                              {message.citations.map((citation, citeIndex) => (
                                <div key={citeIndex} className="text-xs">
                                  <span className="font-medium">[{citeIndex + 1}]</span>{' '}
                                  <a
                                    href={citation.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    {citation.title}
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="text-xs opacity-70 mt-2">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      
                      {message.role === 'user' && (
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                      <div className="bg-muted rounded-lg px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => handleSendMessage(inputMessage)}
                    disabled={isLoading || !inputMessage.trim()}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Preferences */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium">Response Length</label>
                <Tabs
                  value={preferences.response_length}
                  onValueChange={(value) => 
                    setPreferences(prev => ({ ...prev, response_length: value as any }))
                  }
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="brief" className="text-xs">Brief</TabsTrigger>
                    <TabsTrigger value="detailed" className="text-xs">Detailed</TabsTrigger>
                    <TabsTrigger value="comprehensive" className="text-xs">Full</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              <div>
                <label className="text-xs font-medium">Technical Level</label>
                <Tabs
                  value={preferences.technical_level}
                  onValueChange={(value) => 
                    setPreferences(prev => ({ ...prev, technical_level: value as any }))
                  }
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic" className="text-xs">Basic</TabsTrigger>
                    <TabsTrigger value="intermediate" className="text-xs">Medium</TabsTrigger>
                    <TabsTrigger value="advanced" className="text-xs">Advanced</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardContent>
          </Card>

          {/* Follow-up Suggestions */}
          {followUpSuggestions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Follow-up Questions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {followUpSuggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      className="w-full text-left text-xs h-auto p-2 whitespace-normal"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full text-xs justify-start"
                onClick={() => handleSendMessage("What's the latest news in technology?")}
              >
                Latest Tech News
              </Button>
              <Button
                variant="outline"
                className="w-full text-xs justify-start"
                onClick={() => handleSendMessage("Explain quantum computing in simple terms")}
              >
                Quantum Computing
              </Button>
              <Button
                variant="outline"
                className="w-full text-xs justify-start"
                onClick={() => handleSendMessage("What are the benefits of renewable energy?")}
              >
                Renewable Energy
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}