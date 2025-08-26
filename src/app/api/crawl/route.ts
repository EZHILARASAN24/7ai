import { NextRequest, NextResponse } from "next/server";
import { webCrawler } from '@/lib/crawling/web-crawler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, maxDepth = 2, maxPages = 20, includeExternalLinks = false, contentTypes = ['text/html'] } = body;

    // Validate input
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: "Valid URL is required" },
        { status: 400 }
      );
    }

    try {
      new URL(url); // Validate URL format
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Start crawl job
    const jobId = await webCrawler.startCrawl({
      url,
      maxDepth,
      maxPages,
      includeExternalLinks,
      contentTypes
    });

    return NextResponse.json({
      jobId,
      message: "Crawl job started successfully",
      status: "pending"
    });

  } catch (error) {
    console.error('Crawl API error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (jobId) {
      // Get specific job
      const job = await webCrawler.getCrawlJob(jobId);
      if (!job) {
        return NextResponse.json(
          { error: "Job not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(job);
    } else {
      // Get all jobs
      const jobs = await webCrawler.getAllCrawlJobs();
      const stats = await webCrawler.getStats();
      
      return NextResponse.json({
        jobs,
        stats
      });
    }

  } catch (error) {
    console.error('Crawl API error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    const success = await webCrawler.stopCrawl(jobId);
    if (!success) {
      return NextResponse.json(
        { error: "Job not found or already completed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Crawl job stopped successfully"
    });

  } catch (error) {
    console.error('Crawl API error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}