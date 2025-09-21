// ===== COMPREHENSIVE MONITORING & HEALTH CHECK SYSTEM =====
import { HealthChecker } from './reliability-utils';

// ===== MONITORING INTERFACES =====

interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    free: number;
    total: number;
    usage: number;
  };
  disk: {
    used: number;
    free: number;
    total: number;
    usage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
  };
}

interface ApplicationMetrics {
  timestamp: Date;
  sessions: {
    active: number;
    total: number;
    expired: number;
  };
  calls: {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
  };
  api: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
  };
  llm: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    tokensUsed: number;
  };
  errors: {
    total: number;
    byType: Record;
    recent: Array;
  };
}

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record;
}

// ===== SYSTEM MONITORING =====

export class SystemMonitor {
  private static metrics: SystemMetrics[] = [];
  private static maxMetricsHistory = 1000;

  static async collectSystemMetrics(): Promise {
    const os = await import('os');

    const metrics: SystemMetrics = {
      timestamp: new Date(),
      cpu: {
        usage: await this.getCPUUsage(),
        loadAverage: os.loadavg(),
      },
      memory: {
        used: os.totalmem() - os.freemem(),
        free: os.freemem(),
        total: os.totalmem(),
        usage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
      },
      disk: await this.getDiskUsage(),
      network: await this.getNetworkStats(),
    };

    // Store metrics
    this.metrics.push(metrics);
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    return metrics;
  }

  private static async getCPUUsage(): Promise {
    const os = await import('os');
    const cpus = os.cpus();

    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    }

    return 100 - Math.round((totalIdle / totalTick) * 100);
  }

  private static async getDiskUsage(): Promise {
    // Mock implementation - in production, use a library like 'diskusage'
    return {
      used: 50000000000, // 50GB
      free: 100000000000, // 100GB
      total: 150000000000, // 150GB
      usage: 33.33,
    };
  }

  private static async getNetworkStats(): Promise {
    // Mock implementation - in production, use system monitoring tools
    return {
      bytesIn: 1000000,
      bytesOut: 500000,
      connections: 25,
    };
  }

  static getSystemMetricsHistory(): SystemMetrics[] {
    return [...this.metrics];
  }

  static getLatestSystemMetrics(): SystemMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }
}

// ===== APPLICATION MONITORING =====

export class ApplicationMonitor {
  private static metrics: ApplicationMetrics[] = [];
  private static currentMetrics: ApplicationMetrics;
  private static maxMetricsHistory = 1000;
  private static maxErrorHistory = 100;

  static initialize(): void {
    this.currentMetrics = {
      timestamp: new Date(),
      sessions: { active: 0, total: 0, expired: 0 },
      calls: { total: 0, successful: 0, failed: 0, averageDuration: 0 },
      api: { totalRequests: 0, successfulRequests: 0, failedRequests: 0, averageResponseTime: 0 },
      llm: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        tokensUsed: 0,
      },
      errors: { total: 0, byType: {}, recent: [] },
    };
  }

  static recordSessionStart(): void {
    this.currentMetrics.sessions.active++;
    this.currentMetrics.sessions.total++;
  }

  static recordSessionEnd(success: boolean): void {
    this.currentMetrics.sessions.active--;
    if (!success) {
      this.currentMetrics.sessions.expired++;
    }
  }

  static recordCall(success: boolean, duration: number): void {
    this.currentMetrics.calls.total++;
    if (success) {
      this.currentMetrics.calls.successful++;
    } else {
      this.currentMetrics.calls.failed++;
    }

    // Update average duration
    const totalSuccessful = this.currentMetrics.calls.successful;
    this.currentMetrics.calls.averageDuration =
      (this.currentMetrics.calls.averageDuration * (totalSuccessful - 1) + duration) /
      totalSuccessful;
  }

  static recordAPIRequest(success: boolean, responseTime: number): void {
    this.currentMetrics.api.totalRequests++;
    if (success) {
      this.currentMetrics.api.successfulRequests++;
    } else {
      this.currentMetrics.api.failedRequests++;
    }

    // Update average response time
    const totalRequests = this.currentMetrics.api.totalRequests;
    this.currentMetrics.api.averageResponseTime =
      (this.currentMetrics.api.averageResponseTime * (totalRequests - 1) + responseTime) /
      totalRequests;
  }

  static recordLLMRequest(success: boolean, responseTime: number, tokensUsed: number = 0): void {
    this.currentMetrics.llm.totalRequests++;
    if (success) {
      this.currentMetrics.llm.successfulRequests++;
      this.currentMetrics.llm.tokensUsed += tokensUsed;
    } else {
      this.currentMetrics.llm.failedRequests++;
    }

    // Update average response time
    const totalRequests = this.currentMetrics.llm.totalRequests;
    this.currentMetrics.llm.averageResponseTime =
      (this.currentMetrics.llm.averageResponseTime * (totalRequests - 1) + responseTime) /
      totalRequests;
  }

  static recordError(type: string, message: string, stack?: string): void {
    this.currentMetrics.errors.total++;

    // Update error count by type
    if (!this.currentMetrics.errors.byType[type]) {
      this.currentMetrics.errors.byType[type] = 0;
    }
    this.currentMetrics.errors.byType[type]++;

    // Add to recent errors
    this.currentMetrics.errors.recent.push({
      timestamp: new Date(),
      type,
      message,
      stack,
    });

    // Keep only recent errors
    if (this.currentMetrics.errors.recent.length > this.maxErrorHistory) {
      this.currentMetrics.errors.recent.shift();
    }
  }

  static snapshot(): ApplicationMetrics {
    const snapshot = { ...this.currentMetrics };
    this.metrics.push(snapshot);

    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    return snapshot;
  }

  static getApplicationMetricsHistory(): ApplicationMetrics[] {
    return [...this.metrics];
  }

  static getCurrentMetrics(): ApplicationMetrics {
    return { ...this.currentMetrics };
  }
}

// ===== ALERTING SYSTEM =====

export class AlertManager {
  private static alerts: Alert[] = [];
  private static maxAlerts = 500;
  private static alertRules: Array = [];

  static initialize(): void {
    // Define alert rules
    this.alertRules = [
      {
        name: 'high_error_rate',
        condition: (metrics) => metrics.errors.total > 10,
        severity: 'high',
        message: 'High error rate detected',
      },
      {
        name: 'low_success_rate',
        condition: (metrics) => {
          const totalCalls = metrics.calls.total;
          return totalCalls > 0 && metrics.calls.successful / totalCalls < 0.8;
        },
        severity: 'medium',
        message: 'Low call success rate detected',
      },
      {
        name: 'high_memory_usage',
        condition: (metrics) => {
          const systemMetrics = SystemMonitor.getLatestSystemMetrics();
          return systemMetrics ? systemMetrics.memory.usage > 90 : false;
        },
        severity: 'high',
        message: 'High memory usage detected',
      },
      {
        name: 'api_failures',
        condition: (metrics) => {
          const totalRequests = metrics.api.totalRequests;
          return totalRequests > 0 && metrics.api.failedRequests / totalRequests > 0.1;
        },
        severity: 'medium',
        message: 'High API failure rate detected',
      },
      {
        name: 'llm_failures',
        condition: (metrics) => {
          const totalRequests = metrics.llm.totalRequests;
          return totalRequests > 0 && metrics.llm.failedRequests / totalRequests > 0.05;
        },
        severity: 'high',
        message: 'High LLM failure rate detected',
      },
    ];
  }

  static checkAlerts(metrics: ApplicationMetrics): void {
    for (const rule of this.alertRules) {
      if (rule.condition(metrics)) {
        this.createAlert(rule.name, rule.severity, rule.message, {
          metrics: {
            calls: metrics.calls,
            api: metrics.api,
            llm: metrics.llm,
            errors: metrics.errors,
          },
        });
      }
    }
  }

  static createAlert(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    metadata?: Record,
  ): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: severity === 'critical' ? 'error' : severity === 'high' ? 'warning' : 'info',
      severity,
      title: `${severity.toUpperCase()}: ${type}`,
      message,
      timestamp: new Date(),
      resolved: false,
      metadata,
    };

    this.alerts.push(alert);

    if (this.alerts.length > this.maxAlerts) {
      this.alerts.shift();
    }

    console.log(`🚨 ALERT [${severity.toUpperCase()}]: ${message}`, metadata);
  }

  static resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      console.log(`✅ Alert resolved: ${alert.title}`);
      return true;
    }
    return false;
  }

  static getActiveAlerts(): Alert[] {
    return this.alerts.filter((alert) => !alert.resolved);
  }

  static getAllAlerts(): Alert[] {
    return [...this.alerts];
  }

  static getAlertsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): Alert[] {
    return this.alerts.filter((alert) => alert.severity === severity);
  }
}

// ===== HEALTH CHECK SYSTEM =====

export class EnhancedHealthChecker {
  private static checks: Map = new Map();

  static registerCheck(name: string, check: () => Promise): void {
    this.checks.set(name, check);
  }

  static async runAllChecks(): Promise {
    const results: { [key: string]: { healthy: boolean; details?: any; error?: string } } = {};
    let allHealthy = true;

    for (const [name, check] of this.checks.entries()) {
      try {
        const result = await check();
        results[name] = result;
        if (!result.healthy) {
          allHealthy = false;
        }
      } catch (error) {
        results[name] = {
          healthy: false,
          error: (error as Error).message,
        };
        allHealthy = false;
      }
    }

    return {
      overall: allHealthy,
      checks: results,
      timestamp: new Date(),
    };
  }

  static async isHealthy(): Promise {
    const results = await this.runAllChecks();
    return results.overall;
  }
}

// ===== MONITORING DASHBOARD DATA =====

export class MonitoringDashboard {
  static async getDashboardData(): Promise {
    const systemMetrics = SystemMonitor.getLatestSystemMetrics();
    const applicationMetrics = ApplicationMonitor.getCurrentMetrics();
    const activeAlerts = AlertManager.getActiveAlerts();
    const healthStatus = await EnhancedHealthChecker.runAllChecks();
    const uptime = process.uptime();

    return {
      system: systemMetrics,
      application: applicationMetrics,
      alerts: activeAlerts,
      health: healthStatus,
      uptime,
    };
  }

  static async getMetricsHistory(hours: number = 24): Promise {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const systemHistory = SystemMonitor.getSystemMetricsHistory().filter(
      (metrics) => metrics.timestamp >= cutoffTime,
    );

    const applicationHistory = ApplicationMonitor.getApplicationMetricsHistory().filter(
      (metrics) => metrics.timestamp >= cutoffTime,
    );

    return {
      system: systemHistory,
      application: applicationHistory,
    };
  }
}

// ===== INITIALIZATION =====

export function initializeMonitoringSystem(): void {
  console.log('🔧 Initializing monitoring system...');

  // Initialize application monitoring
  ApplicationMonitor.initialize();
  AlertManager.initialize();

  // Register health checks
  EnhancedHealthChecker.registerCheck('database', async () => {
    try {
      // Mock database health check
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { healthy: true, details: { connection: 'active' } };
    } catch (error) {
      return { healthy: false, error: (error as Error).message };
    }
  });

  EnhancedHealthChecker.registerCheck('openrouter', async () => {
    try {
      // Mock OpenRouter health check
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      });
      return {
        healthy: response.ok,
        details: { status: response.status },
      };
    } catch (error) {
      return { healthy: false, error: (error as Error).message };
    }
  });

  EnhancedHealthChecker.registerCheck('deepgram', async () => {
    try {
      // Mock Deepgram health check
      return { healthy: true, details: { status: 'active' } };
    } catch (error) {
      return { healthy: false, error: (error as Error).message };
    }
  });

  EnhancedHealthChecker.registerCheck('cartesia', async () => {
    try {
      // Mock Cartesia health check
      return { healthy: true, details: { status: 'active' } };
    } catch (error) {
      return { healthy: false, error: (error as Error).message };
    }
  });

  // Start periodic monitoring
  setInterval(async () => {
    try {
      // Collect system metrics
      await SystemMonitor.collectSystemMetrics();

      // Snapshot application metrics
      const appMetrics = ApplicationMonitor.snapshot();

      // Check for alerts
      AlertManager.checkAlerts(appMetrics);
    } catch (error) {
      console.error('❌ Error in monitoring system:', error);
    }
  }, 60000); // Every minute

  console.log('✅ Monitoring system initialized');
}

// ===== EXPORT ALL MONITORING UTILITIES =====

export {
  SystemMonitor,
  ApplicationMonitor,
  AlertManager,
  EnhancedHealthChecker,
  MonitoringDashboard,
};

