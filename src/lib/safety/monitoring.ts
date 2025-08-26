export interface SystemMetrics {
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  active_connections: number;
  response_time: number;
  error_rate: number;
  throughput: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    api_health: boolean;
    database_health: boolean;
    agent_health: boolean;
    memory_health: boolean;
    cpu_health: boolean;
  };
  metrics: SystemMetrics;
  last_check: string;
}

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
  resolved_at?: string;
  metadata?: Record<string, any>;
}

class SystemMonitor {
  private metrics: SystemMetrics[] = [];
  private alerts: Alert[] = [];
  private healthChecks: Map<string, () => Promise<boolean>> = new Map();
  private thresholds = {
    cpu_warning: 70,
    cpu_critical: 90,
    memory_warning: 80,
    memory_critical: 95,
    response_time_warning: 2000,
    response_time_critical: 5000,
    error_rate_warning: 5,
    error_rate_critical: 10,
  };

  constructor() {
    this.initializeHealthChecks();
    this.startMonitoring();
  }

  private initializeHealthChecks(): void {
    this.healthChecks.set('api_health', async () => {
      try {
        // For client-side monitoring, we'll use a more reliable approach
        // Check if we can make basic API calls
        if (typeof window !== 'undefined') {
          // Try to fetch from the same origin with a timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          try {
            const response = await fetch('/api/health', {
              method: 'GET',
              signal: controller.signal,
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });
            clearTimeout(timeoutId);
            return response.ok;
          } catch (error) {
            clearTimeout(timeoutId);
            // If fetch fails, try a simple ping to the domain
            try {
              const pingResponse = await fetch('/', {
                method: 'HEAD',
                signal: controller.signal
              });
              return pingResponse.ok;
            } catch {
              return false;
            }
          }
        } else {
          // Server-side environment - assume healthy
          return true;
        }
      } catch {
        return false;
      }
    });

    this.healthChecks.set('database_health', async () => {
      try {
        // For now, we'll simulate database health
        // In a real implementation, this would check actual database connectivity
        if (typeof window !== 'undefined') {
          // Client-side - use a simple heuristic
          return Math.random() > 0.1; // 90% success rate for demo
        } else {
          // Server-side - assume healthy for now
          return true;
        }
      } catch {
        return false;
      }
    });

    this.healthChecks.set('agent_health', async () => {
      try {
        // Check if agent system is responsive
        // For now, simulate agent health
        if (typeof window !== 'undefined') {
          // Client-side - use a simple heuristic
          return Math.random() > 0.05; // 95% success rate for demo
        } else {
          // Server-side - assume healthy for now
          return true;
        }
      } catch {
        return false;
      }
    });

    this.healthChecks.set('memory_health', async () => {
      try {
        if (typeof process !== 'undefined' && process.memoryUsage) {
          const usage = process.memoryUsage();
          const percentUsed = (usage.heapUsed / usage.heapTotal) * 100;
          return percentUsed < this.thresholds.memory_critical;
        } else if (typeof window !== 'undefined') {
          // Client-side - check if performance API is available
          if (window.performance && window.performance.memory) {
            const memory = window.performance.memory;
            const percentUsed = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
            return percentUsed < this.thresholds.memory_critical;
          }
          // Fallback - assume healthy
          return true;
        }
        return true;
      } catch {
        return true; // Assume healthy if we can't check
      }
    });

    this.healthChecks.set('cpu_health', async () => {
      try {
        // Simple CPU health check - in production, use proper CPU monitoring
        if (typeof window !== 'undefined') {
          // Client-side - use a simple heuristic based on performance
          if (window.performance) {
            // Check if the page is responsive
            const start = performance.now();
            let counter = 0;
            for (let i = 0; i < 1000000; i++) {
              counter += i;
            }
            const end = performance.now();
            const duration = end - start;
            // If the operation takes too long, CPU might be busy
            return duration < 100; // Less than 100ms is good
          }
        }
        return true; // Assume healthy if we can't check
      } catch {
        return true; // Assume healthy if we can't check
      }
    });
  }

  private startMonitoring(): void {
    // Collect metrics every 30 seconds
    setInterval(() => this.collectMetrics(), 30000);
    
    // Run health checks every minute
    setInterval(() => this.runHealthChecks(), 60000);
    
    // Clean up old metrics every hour
    setInterval(() => this.cleanupOldData(), 3600000);
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics: SystemMetrics = {
        timestamp: new Date().toISOString(),
        cpu_usage: await this.getCPUUsage(),
        memory_usage: await this.getMemoryUsage(),
        disk_usage: await this.getDiskUsage(),
        active_connections: await this.getActiveConnections(),
        response_time: await this.getAverageResponseTime(),
        error_rate: await this.getErrorRate(),
        throughput: await this.getThroughput(),
      };

      this.metrics.push(metrics);
      
      // Check for threshold violations
      await this.checkThresholds(metrics);
      
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  private async runHealthChecks(): Promise<HealthStatus> {
    const checks: Record<string, boolean> = {};
    
    for (const [name, checkFn] of this.healthChecks) {
      try {
        checks[name] = await checkFn();
      } catch (error) {
        console.error(`Health check ${name} failed:`, error);
        checks[name] = false;
      }
    }

    const allHealthy = Object.values(checks).every(Boolean);
    const someHealthy = Object.values(checks).some(Boolean);

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (allHealthy) status = 'healthy';
    else if (someHealthy) status = 'degraded';
    else status = 'unhealthy';

    const latestMetrics = this.metrics[this.metrics.length - 1] || this.getDefaultMetrics();

    const healthStatus: HealthStatus = {
      status,
      checks,
      metrics: latestMetrics,
      last_check: new Date().toISOString(),
    };

    // Generate alerts for unhealthy services
    Object.entries(checks).forEach(([service, isHealthy]) => {
      if (!isHealthy) {
        this.createAlert('error', `${service} check failed`, { service });
      }
    });

    return healthStatus;
  }

  private async checkThresholds(metrics: SystemMetrics): Promise<void> {
    // CPU thresholds
    if (metrics.cpu_usage > this.thresholds.cpu_critical) {
      this.createAlert('critical', `CPU usage critical: ${metrics.cpu_usage.toFixed(1)}%`);
    } else if (metrics.cpu_usage > this.thresholds.cpu_warning) {
      this.createAlert('warning', `CPU usage high: ${metrics.cpu_usage.toFixed(1)}%`);
    }

    // Memory thresholds
    if (metrics.memory_usage > this.thresholds.memory_critical) {
      this.createAlert('critical', `Memory usage critical: ${metrics.memory_usage.toFixed(1)}%`);
    } else if (metrics.memory_usage > this.thresholds.memory_warning) {
      this.createAlert('warning', `Memory usage high: ${metrics.memory_usage.toFixed(1)}%`);
    }

    // Response time thresholds
    if (metrics.response_time > this.thresholds.response_time_critical) {
      this.createAlert('critical', `Response time critical: ${metrics.response_time.toFixed(0)}ms`);
    } else if (metrics.response_time > this.thresholds.response_time_warning) {
      this.createAlert('warning', `Response time high: ${metrics.response_time.toFixed(0)}ms`);
    }

    // Error rate thresholds
    if (metrics.error_rate > this.thresholds.error_rate_critical) {
      this.createAlert('critical', `Error rate critical: ${metrics.error_rate.toFixed(1)}%`);
    } else if (metrics.error_rate > this.thresholds.error_rate_warning) {
      this.createAlert('warning', `Error rate high: ${metrics.error_rate.toFixed(1)}%`);
    }
  }

  private createAlert(type: 'warning' | 'error' | 'critical', message: string, metadata?: Record<string, any>): void {
    const alert: Alert = {
      id: this.generateAlertId(),
      type,
      message,
      timestamp: new Date().toISOString(),
      resolved: false,
      metadata,
    };

    this.alerts.push(alert);
    console.log(`ALERT [${type.toUpperCase()}]: ${message}`);
    
    // In production, send alerts to external monitoring systems
    this.sendAlertToExternalSystems(alert);
  }

  private sendAlertToExternalSystems(alert: Alert): void {
    // Placeholder for external alert integration
    // Could send to Slack, email, PagerDuty, etc.
    console.log(`External alert would be sent: ${alert.message}`);
  }

  private cleanupOldData(): void {
    const oneHourAgo = Date.now() - 3600000;
    
    // Keep only last hour of metrics
    this.metrics = this.metrics.filter(metric => 
      new Date(metric.timestamp).getTime() > oneHourAgo
    );
    
    // Keep only last 24 hours of resolved alerts
    const oneDayAgo = Date.now() - 86400000;
    this.alerts = this.alerts.filter(alert => 
      !alert.resolved || new Date(alert.timestamp).getTime() > oneDayAgo
    );
  }

  // Helper methods for metric collection
  private async getCPUUsage(): Promise<number> {
    // Placeholder - in production, use proper CPU monitoring
    return Math.random() * 100;
  }

  private async getMemoryUsage(): Promise<number> {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return (usage.heapUsed / usage.heapTotal) * 100;
    }
    return Math.random() * 100;
  }

  private async getDiskUsage(): Promise<number> {
    // Placeholder - in production, use proper disk monitoring
    return Math.random() * 100;
  }

  private async getActiveConnections(): Promise<number> {
    // Placeholder - implement actual connection counting
    return Math.floor(Math.random() * 100);
  }

  private async getAverageResponseTime(): Promise<number> {
    // Placeholder - implement actual response time tracking
    return Math.random() * 5000;
  }

  private async getErrorRate(): Promise<number> {
    // Placeholder - implement actual error rate calculation
    return Math.random() * 10;
  }

  private async getThroughput(): Promise<number> {
    // Placeholder - implement actual throughput calculation
    return Math.random() * 1000;
  }

  private getDefaultMetrics(): SystemMetrics {
    return {
      timestamp: new Date().toISOString(),
      cpu_usage: 0,
      memory_usage: 0,
      disk_usage: 0,
      active_connections: 0,
      response_time: 0,
      error_rate: 0,
      throughput: 0,
    };
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  async getCurrentHealth(): Promise<HealthStatus> {
    return await this.runHealthChecks();
  }

  async getMetrics(timeRange: number = 3600000): Promise<SystemMetrics[]> {
    const cutoff = Date.now() - timeRange;
    return this.metrics.filter(metric => 
      new Date(metric.timestamp).getTime() > cutoff
    );
  }

  async getAlerts(includeResolved: boolean = false): Promise<Alert[]> {
    if (includeResolved) {
      return this.alerts;
    }
    return this.alerts.filter(alert => !alert.resolved);
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolved_at = new Date().toISOString();
      return true;
    }
    return false;
  }

  updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }
}

// Export singleton instance
export const systemMonitor = new SystemMonitor();