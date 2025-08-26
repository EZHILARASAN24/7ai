'use client';

import { useState } from 'react';
import { Search, Send, Loader2, ExternalLink, BookOpen, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

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

export default function SearchInterface() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'hybrid' | 'web' | 'vector'>('hybrid');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a search query.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setSearchResults(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          search_type: searchType,
          max_results: 10,
          include_citations: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data: SearchResponse = await response.json();
      setSearchResults(data);

      toast({
        title: "Search Complete",
        description: `Found ${data.sources.length} sources in ${data.processing_time.toFixed(2)}s`,
      });
    } catch (error) {
      toast({
        title: "Search Error",
        description: "Failed to perform search. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSearch();
    }
  };

  const formatConfidenceScore = (score: number) => {
    const percentage = Math.round(score * 100);
    const color = percentage >= 80 ? 'text-green-600' : percentage >= 60 ? 'text-yellow-600' : 'text-red-600';
    return <span className={color}>{percentage}%</span>;
  };

  const formatResponse = (response: string) => {
    // Simple formatting for citations in the response
    return response.replace(/\[Source (\d+)\]/g, (match, sourceNum) => {
      const sourceIndex = parseInt(sourceNum) - 1;
      const source = searchResults?.sources[sourceIndex];
      if (source) {
        return `<sup class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200" title="${source.title}" onclick="window.open('${source.url}', '_blank')">${sourceNum}</sup>`;
      }
      return match;
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Conversational Search</h1>
        <p className="text-muted-foreground">
          Ask questions and get comprehensive answers with verified sources
        </p>
      </div>

      {/* Search Input */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="What would you like to know?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                className="text-lg"
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={isLoading || !query.trim()}
              size="lg"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          {/* Search Type Selection */}
          <div className="flex gap-2 mt-4">
            <Tabs value={searchType} onValueChange={(value) => setSearchType(value as any)}>
              <TabsList>
                <TabsTrigger value="hybrid">Hybrid Search</TabsTrigger>
                <TabsTrigger value="web">Web Only</TabsTrigger>
                <TabsTrigger value="vector">Knowledge Base</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Response */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Answer</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      Confidence: {formatConfidenceScore(searchResults.confidence_score)}
                    </Badge>
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      {searchResults.processing_time.toFixed(2)}s
                    </Badge>
                  </div>
                </div>
                <CardDescription>
                  Generated from {searchResults.sources.length} sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: formatResponse(searchResults.response) 
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sources Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Sources ({searchResults.sources.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {searchResults.sources.map((source, index) => (
                      <div key={source.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">
                              {source.title}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {source.snippet}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                {source.source_type}
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                              >
                                {Math.round(source.relevance_score * 100)}%
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(source.url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Citations */}
            {searchResults.citations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Citations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {searchResults.citations.map((citation, index) => (
                        <div key={citation.id} className="text-xs">
                          <span className="font-medium">[{index + 1}]</span>{' '}
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
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Searching and analyzing sources...</p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!searchResults && !isLoading && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Start Your Search</h3>
            <p className="text-muted-foreground">
              Enter a question or topic above to get comprehensive answers with verified sources.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}