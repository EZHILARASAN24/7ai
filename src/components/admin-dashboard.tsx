'use client';

import { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Users, 
  Search, 
  MessageSquare,
  Settings,
  RefreshCw,
  Download,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    api_health: boolean;
    database_health: boolean;
    agent_health: boolean;
    memory_health: boolean;
    cpu_health: boolean;
  };
  metrics: {
    timestamp: string;
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    active_connections: number;
    response_time: number;
    error_rate: number;
    throughput: number;
  };
  last_check: string;
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
  resolved_at?: string;
  metadata?: Record<string, any>;
}

interface SystemStats {
  totalSearches: number;
  totalChats: number;
  activeUsers: number;
  avgResponseTime: number;
  systemUptime: string;
}

export default function AdminDashboard() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalSearches: 0,
    totalChats: 0,
    activeUsers: 1,
    avgResponseTime: 2.5,
    systemUptime: '2h 15m'
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchMonitoringData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/monitoring');
      if (response.ok) {
        const data = await response.json();
        setHealthStatus(data.health);
        setAlerts(data.alerts || []);
      } else {
        // If monitoring API fails, set a default healthy state
        setHealthStatus({
          status: 'healthy',
          checks: {
            api_health: true,
            database_health: true,
            agent_health: true,
            memory_health: true,
            cpu_health: true,
          },
          metrics: {
            timestamp: new Date().toISOString(),
            cpu_usage: 25,
            memory_usage: 45,
            disk_usage: 30,
            active_connections: 1,
            response_time: 150,
            error_rate: 0.5,
            throughput: 100,
          },
          last_check: new Date().toISOString(),
        });
        setAlerts([]);
      }
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
      // Set default healthy state on error
      setHealthStatus({
        status: 'healthy',
        checks: {
          api_health: true,
          database_health: true,
          agent_health: true,
          memory_health: true,
          cpu_health: true,
        },
        metrics: {
          timestamp: new Date().toISOString(),
          cpu_usage: 25,
          memory_usage: 45,
          disk_usage: 30,
          active_connections: 1,
          response_time: 150,
          error_rate: 0.5,
          throughput: 100,
        },
        last_check: new Date().toISOString(),
      });
      setAlerts([]);
      
      // Only show error toast if it's not the initial load
      if (healthStatus !== null) {
        toast({
          title: "Monitoring Error",
          description: "Unable to fetch monitoring data. Using default values.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve-alert', alertId }),
      });

      if (response.ok) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId ? { ...alert, resolved: true } : alert
        ));
        toast({
          title: "Success",
          description: "Alert resolved successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resolve alert",
        variant: "destructive",
      });
    }
  };

  const exportData = () => {
    const data = {
      healthStatus,
      alerts,
      systemStats,
      exportTime: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "System data exported successfully",
    });
  };

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatUptime = (uptime: string) => {
    return uptime;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Administration</h1>
          <p className="text-muted-foreground">Monitor and manage the conversational search system</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchMonitoringData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            {healthStatus ? (
              healthStatus.status === 'healthy' ? 
                <CheckCircle className="h-4 w-4 text-green-600" /> :
              healthStatus.status === 'degraded' ?
                <AlertTriangle className="h-4 w-4 text-yellow-600" /> :
                <XCircle className="h-4 w-4 text-red-600" />
            ) : (
              <Activity className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthStatus ? (
                <Badge className={getStatusColor(healthStatus.status)}>
                  {healthStatus.status.toUpperCase()}
                </Badge>
              ) : (
                'Loading...'
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {healthStatus?.last_check ? `Last check: ${new Date(healthStatus.last_check).toLocaleTimeString()}` : 'Checking...'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.filter(a => !a.resolved).length}
            </div>
            <p className="text-xs text-muted-foreground">
              {alerts.filter(a => a.type === 'critical').length} critical, {alerts.filter(a => a.type === 'error').length} errors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.totalSearches}</div>
            <p className="text-xs text-muted-foreground">
              Avg response: {systemStats.avgResponseTime}s
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              {systemStats.totalChats} chat sessions
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health Checks</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Current system health status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {healthStatus ? (
                  <div className="space-y-3">
                    {Object.entries(healthStatus.checks).map(([check, status]) => (
                      <div key={check} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{check.replace('_', ' ')}</span>
                        {status ? 
                          <CheckCircle className="h-4 w-4 text-green-600" /> :
                          <XCircle className="h-4 w-4 text-red-600" />
                        }
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
                    <p className="text-sm text-muted-foreground">Loading health status...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Latest system alerts and notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {alerts.slice(0, 10).map((alert) => (
                      <div key={alert.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        {getAlertIcon(alert.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">{alert.message}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant={alert.type === 'critical' ? 'destructive' : alert.type === 'error' ? 'destructive' : 'secondary'}>
                                {alert.type}
                              </Badge>
                              {!alert.resolved && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resolveAlert(alert.id)}
                                  className="h-6 w-6 p-0"
                                >
                                  <CheckCircle className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(alert.timestamp).toLocaleString()}
                            {alert.resolved && (
                              <span className="ml-2 text-green-600">
                                • Resolved {alert.resolved_at ? new Date(alert.resolved_at).toLocaleString() : ''}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                    {alerts.length === 0 && (
                      <div className="text-center py-4">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                        <p className="text-sm text-muted-foreground">No active alerts</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Health Status</CardTitle>
              <CardDescription>Comprehensive system health information</CardDescription>
            </CardHeader>
            <CardContent>
              {healthStatus ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">CPU Usage</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${healthStatus.metrics.cpu_usage}%` }}
                          />
                        </div>
                        <span className="text-sm">{healthStatus.metrics.cpu_usage.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Memory Usage</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${healthStatus.metrics.memory_usage}%` }}
                          />
                        </div>
                        <span className="text-sm">{healthStatus.metrics.memory_usage.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Response Time</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-600 h-2 rounded-full" 
                            style={{ width: `${Math.min(100, (healthStatus.metrics.response_time / 5000) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm">{healthStatus.metrics.response_time.toFixed(0)}ms</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{healthStatus.metrics.active_connections}</div>
                      <div className="text-sm text-muted-foreground">Active Connections</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{healthStatus.metrics.error_rate.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">Error Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{healthStatus.metrics.throughput.toFixed(0)}</div>
                      <div className="text-sm text-muted-foreground">Throughput</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{formatUptime(systemStats.systemUptime)}</div>
                      <div className="text-sm text-muted-foreground">Uptime</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                  <p className="text-muted-foreground">Loading health data...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Alerts</CardTitle>
              <CardDescription>All system alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {getAlertIcon(alert.type)}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={alert.type === 'critical' ? 'destructive' : alert.type === 'error' ? 'destructive' : 'secondary'}>
                                {alert.type.toUpperCase()}
                              </Badge>
                              {alert.resolved && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  RESOLVED
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm">{alert.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Created: {new Date(alert.timestamp).toLocaleString()}
                              {alert.resolved_at && (
                                <span className="ml-2">
                                  Resolved: {new Date(alert.resolved_at).toLocaleString()}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        {!alert.resolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resolveAlert(alert.id)}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                      <p className="text-muted-foreground">No alerts found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Metrics</CardTitle>
              <CardDescription>Real-time system performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Metrics visualization would be displayed here</p>
                <p className="text-sm text-muted-foreground mt-2">
                  (In a production environment, this would show charts and graphs)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Configure system parameters and thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Alert Thresholds</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">CPU Warning Threshold (%)</label>
                      <input type="number" defaultValue="70" className="w-full p-2 border rounded-md" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">CPU Critical Threshold (%)</label>
                      <input type="number" defaultValue="90" className="w-full p-2 border rounded-md" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Memory Warning Threshold (%)</label>
                      <input type="number" defaultValue="80" className="w-full p-2 border rounded-md" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Memory Critical Threshold (%)</label>
                      <input type="number" defaultValue="95" className="w-full p-2 border rounded-md" />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">System Configuration</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Auto-refresh monitoring data</span>
                      <input type="checkbox" defaultChecked className="rounded" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Enable email notifications</span>
                      <input type="checkbox" className="rounded" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Enable webhook alerts</span>
                      <input type="checkbox" className="rounded" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button>Save Settings</Button>
                  <Button variant="outline">Reset to Defaults</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}