import ZAI from 'z-ai-web-dev-sdk';

export interface CrawlRequest {
  url: string;
  maxDepth?: number;
  maxPages?: number;
  includeExternalLinks?: boolean;
  contentTypes?: string[];
}

export interface CrawlResult {
  url: string;
  title: string;
  content: string;
  links: string[];
  metadata: {
    contentLength: number;
    wordCount: number;
    crawlTime: string;
    statusCode?: number;
    contentType?: string;
    lastModified?: string;
  };
}

export interface CrawlJob {
  id: string;
  request: CrawlRequest;
  status: 'pending' | 'crawling' | 'completed' | 'failed';
  results: CrawlResult[];
  startTime?: string;
  endTime?: string;
  error?: string;
  stats: {
    totalPages: number;
    successfulPages: number;
    failedPages: number;
    averageResponseTime: number;
  };
}

class WebCrawler {
  private activeJobs: Map<string, CrawlJob> = new Map();
  private maxConcurrentJobs: number = 3;
  private zai: ZAI | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.zai = await ZAI.create();
    } catch (error) {
      console.error('Failed to initialize ZAI for web crawler:', error);
    }
  }

  async startCrawl(request: CrawlRequest): Promise<string> {
    const jobId = this.generateJobId();
    const job: CrawlJob = {
      id: jobId,
      request,
      status: 'pending',
      results: [],
      stats: {
        totalPages: 0,
        successfulPages: 0,
        failedPages: 0,
        averageResponseTime: 0
      }
    };

    this.activeJobs.set(jobId, job);
    
    // Start crawling in background
    this.executeCrawl(jobId).catch(error => {
      console.error(`Crawl job ${jobId} failed:`, error);
    });

    return jobId;
  }

  async getCrawlJob(jobId: string): Promise<CrawlJob | undefined> {
    return this.activeJobs.get(jobId);
  }

  async getAllCrawlJobs(): Promise<CrawlJob[]> {
    return Array.from(this.activeJobs.values());
  }

  async stopCrawl(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (job && (job.status === 'pending' || job.status === 'crawling')) {
      job.status = 'failed';
      job.error = 'Crawl stopped by user';
      job.endTime = new Date().toISOString();
      return true;
    }
    return false;
  }

  private async executeCrawl(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.status = 'crawling';
    job.startTime = new Date().toISOString();

    try {
      const urlsToCrawl = new Set<string>([job.request.url]);
      const crawledUrls = new Set<string>();
      const results: CrawlResult[] = [];
      const responseTimes: number[] = [];

      while (urlsToCrawl.size > 0 && results.length < (job.request.maxPages || 50)) {
        const currentUrl = urlsToCrawl.values().next().value;
        urlsToCrawl.delete(currentUrl);

        if (crawledUrls.has(currentUrl)) continue;
        crawledUrls.add(currentUrl);

        const startTime = Date.now();
        
        try {
          const result = await this.crawlSingleUrl(currentUrl, job.request);
          const responseTime = Date.now() - startTime;
          responseTimes.push(responseTime);

          results.push(result);
          job.stats.successfulPages++;

          // Extract links for further crawling
          if (this.shouldContinueCrawling(job, results.length)) {
            const newLinks = this.extractLinks(result, job.request);
            newLinks.forEach(link => {
              if (!crawledUrls.has(link) && this.isValidUrl(link, job.request)) {
                urlsToCrawl.add(link);
              }
            });
          }

        } catch (error) {
          console.error(`Failed to crawl ${currentUrl}:`, error);
          job.stats.failedPages++;
        }

        // Small delay to be respectful
        await this.delay(100);
      }

      job.results = results;
      job.stats.totalPages = results.length;
      job.stats.averageResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0;

      job.status = 'completed';
      job.endTime = new Date().toISOString();

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.endTime = new Date().toISOString();
    }
  }

  private async crawlSingleUrl(url: string, request: CrawlRequest): Promise<CrawlResult> {
    if (!this.zai) {
      throw new Error('ZAI not initialized');
    }

    try {
      // Use ZAI's web search capability to get page content
      // This is a simplified approach - in production, you'd use a proper web scraping library
      const searchResults = await this.zai.functions.invoke("web_search", {
        query: `site:${new URL(url).hostname} ${this.extractSearchQuery(url)}`,
        num: 1
      });

      if (!Array.isArray(searchResults) || searchResults.length === 0) {
        throw new Error('No content found for URL');
      }

      const result = searchResults[0];
      
      return {
        url: url,
        title: result.name || 'Untitled',
        content: result.snippet || '',
        links: this.extractLinksFromContent(result.snippet || ''),
        metadata: {
          contentLength: (result.snippet || '').length,
          wordCount: (result.snippet || '').split(/\s+/).length,
          crawlTime: new Date().toISOString(),
          statusCode: 200,
          contentType: 'text/html',
          lastModified: result.date || new Date().toISOString()
        }
      };

    } catch (error) {
      throw new Error(`Failed to crawl ${url}: ${error}`);
    }
  }

  private extractSearchQuery(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      return pathParts[pathParts.length - 1] || urlObj.hostname;
    } catch {
      return url;
    }
  }

  private extractLinks(result: CrawlResult, request: CrawlRequest): string[] {
    const links = new Set<string>();
    
    // Extract links from content (simplified)
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    const matches = result.content.match(urlRegex);
    
    if (matches) {
      matches.forEach(link => {
        if (this.isValidUrl(link, request)) {
          links.add(link);
        }
      });
    }

    // Add the links from the result
    result.links.forEach(link => {
      if (this.isValidUrl(link, request)) {
        links.add(link);
      }
    });

    return Array.from(links);
  }

  private extractLinksFromContent(content: string): string[] {
    const links = new Set<string>();
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    const matches = content.match(urlRegex);
    
    if (matches) {
      matches.forEach(link => links.add(link));
    }

    return Array.from(links);
  }

  private isValidUrl(url: string, request: CrawlRequest): boolean {
    try {
      const urlObj = new URL(url);
      const baseUrlObj = new URL(request.url);
      
      // Check if same domain if external links are not allowed
      if (!request.includeExternalLinks && urlObj.hostname !== baseUrlObj.hostname) {
        return false;
      }

      // Basic URL validation
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private shouldContinueCrawling(job: CrawlJob, currentCount: number): boolean {
    if (currentCount >= (job.request.maxPages || 50)) {
      return false;
    }

    // Check depth (simplified - just based on URL depth)
    const baseUrl = new URL(job.request.url);
    const currentDepth = this.getUrlDepth(baseUrl);
    return currentDepth <= (job.request.maxDepth || 2);
  }

  private getUrlDepth(url: URL): number {
    return url.pathname.split('/').filter(p => p).length;
  }

  private generateJobId(): string {
    return `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getStats(): Promise<{
    activeJobs: number;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalPagesCrawled: number;
  }> {
    const jobs = Array.from(this.activeJobs.values());
    
    return {
      activeJobs: jobs.filter(job => job.status === 'crawling').length,
      totalJobs: jobs.length,
      completedJobs: jobs.filter(job => job.status === 'completed').length,
      failedJobs: jobs.filter(job => job.status === 'failed').length,
      totalPagesCrawled: jobs.reduce((sum, job) => sum + job.results.length, 0)
    };
  }
}

// Export singleton instance
export const webCrawler = new WebCrawler();