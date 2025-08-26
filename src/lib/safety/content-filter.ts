export interface SafetyValidation {
  is_safe: boolean;
  issues: string[];
  confidence_score: number;
  categories: {
    harmful_content: boolean;
    inappropriate_language: boolean;
    personal_information: boolean;
    spam: boolean;
    misinformation: boolean;
  };
}

export class ContentFilter {
  private harmfulKeywords = new Set([
    'violence', 'kill', 'murder', 'terrorist', 'bomb', 'weapon', 'gun',
    'hate', 'racist', 'discrimination', 'abuse', 'harassment',
    'illegal', 'drug', 'cocaine', 'heroin', 'overdose'
  ]);

  private inappropriateLanguage = new Set([
    'fuck', 'shit', 'asshole', 'bitch', 'damn', 'crap',
    'retard', 'idiot', 'stupid', 'moron'
  ]);

  private personalInfoPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{16}\b/g, // Credit card
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{10}\b/g, // Phone number
    /\b\d{3}-\d{3}-\d{4}\b/g, // Phone number with dashes
  ];

  private spamPatterns = [
    /click here/gi,
    /limited time offer/gi,
    /act now/gi,
    /free money/gi,
    /get rich quick/gi,
    /no risk/gi,
  ];

  async validateContent(content: string): Promise<SafetyValidation> {
    const issues: string[] = [];
    const categories = {
      harmful_content: false,
      inappropriate_language: false,
      personal_information: false,
      spam: false,
      misinformation: false
    };

    const lowerContent = content.toLowerCase();

    // Check for harmful content
    const foundHarmful = Array.from(this.harmfulKeywords).filter(keyword => 
      lowerContent.includes(keyword)
    );

    if (foundHarmful.length > 0) {
      categories.harmful_content = true;
      issues.push(`Contains potentially harmful content: ${foundHarmful.join(', ')}`);
    }

    // Check for inappropriate language
    const foundInappropriate = Array.from(this.inappropriateLanguage).filter(keyword => 
      lowerContent.includes(keyword)
    );

    if (foundInappropriate.length > 0) {
      categories.inappropriate_language = true;
      issues.push(`Contains inappropriate language: ${foundInappropriate.join(', ')}`);
    }

    // Check for personal information
    const foundPersonalInfo = this.personalInfoPatterns.flatMap(pattern => 
      content.match(pattern) || []
    );

    if (foundPersonalInfo.length > 0) {
      categories.personal_information = true;
      issues.push(`Contains potential personal information: ${foundPersonalInfo.join(', ')}`);
    }

    // Check for spam patterns
    const foundSpamPatterns = this.spamPatterns.filter(pattern => 
      pattern.test(content)
    );

    if (foundSpamPatterns.length > 0) {
      categories.spam = true;
      issues.push(`Contains spam-like patterns`);
    }

    // Check for misinformation indicators
    const misinformationIndicators = [
      content.toLowerCase().includes('conspiracy'),
      content.toLowerCase().includes('hoax'),
      content.toLowerCase().includes('fake news'),
      content.toLowerCase().includes('not true'),
      content.toLowerCase().includes('false information')
    ];

    if (misinformationIndicators.filter(Boolean).length >= 2) {
      categories.misinformation = true;
      issues.push('May contain misinformation');
    }

    // Calculate confidence score
    const totalChecks = Object.keys(categories).length;
    const failedChecks = Object.values(categories).filter(Boolean).length;
    const confidenceScore = Math.max(0, 1 - (failedChecks / totalChecks));

    return {
      is_safe: issues.length === 0,
      issues,
      confidence_score: confidenceScore,
      categories
    };
  }

  async sanitizeContent(content: string): Promise<string> {
    let sanitized = content;

    // Remove personal information
    this.personalInfoPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    // Mask inappropriate language
    this.inappropriateLanguage.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '*'.repeat(word.length));
    });

    // Remove spam patterns
    this.spamPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[FILTERED]');
    });

    return sanitized;
  }

  async generateSafetyReport(content: string): Promise<{
    summary: string;
    recommendations: string[];
    risk_level: 'low' | 'medium' | 'high';
  }> {
    const validation = await this.validateContent(content);
    
    let risk_level: 'low' | 'medium' | 'high' = 'low';
    if (validation.confidence_score < 0.7) risk_level = 'medium';
    if (validation.confidence_score < 0.4) risk_level = 'high';

    const recommendations: string[] = [];

    if (categories.harmful_content) {
      recommendations.push('Review content for harmful material');
    }
    if (categories.inappropriate_language) {
      recommendations.push('Consider using more appropriate language');
    }
    if (categories.personal_information) {
      recommendations.push('Remove or redact personal information');
    }
    if (categories.spam) {
      recommendations.push('Avoid spam-like content patterns');
    }
    if (categories.misinformation) {
      recommendations.push('Verify factual accuracy of information');
    }

    if (recommendations.length === 0) {
      recommendations.push('Content appears safe and appropriate');
    }

    const summary = `Content safety assessment completed. Risk level: ${risk_level.toUpperCase()}. ` +
                   `Found ${validation.issues.length} potential issues. ` +
                   `Confidence score: ${(validation.confidence_score * 100).toFixed(1)}%.`;

    return {
      summary,
      recommendations,
      risk_level
    };
  }
}

// Export singleton instance
export const contentFilter = new ContentFilter();