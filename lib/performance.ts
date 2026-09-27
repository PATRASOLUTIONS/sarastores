/**
 * Performance Monitoring Utilities
 * 
 * Client-side performance tracking for Core Web Vitals
 * and custom performance metrics.
 */

'use client';

// ============================================
// Types
// ============================================

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  id?: string;
  navigationType?: string;
}

interface WebVitalsThresholds {
  good: number;
  needsImprovement: number;
}

type MetricCallback = (metric: PerformanceMetric) => void;

// ============================================
// Thresholds (based on Core Web Vitals)
// ============================================

const THRESHOLDS: Record<string, WebVitalsThresholds> = {
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FCP: { good: 1800, needsImprovement: 3000 },
  FID: { good: 100, needsImprovement: 300 },
  INP: { good: 200, needsImprovement: 500 },
  LCP: { good: 2500, needsImprovement: 4000 },
  TTFB: { good: 800, needsImprovement: 1800 },
};

// ============================================
// Rating Calculation
// ============================================

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name];
  if (!threshold) return 'good';
  
  if (value <= threshold.good) return 'good';
  if (value <= threshold.needsImprovement) return 'needs-improvement';
  return 'poor';
}

// ============================================
// Core Web Vitals Reporter
// ============================================

let metricsCallback: MetricCallback | null = null;
const collectedMetrics: PerformanceMetric[] = [];

/**
 * Report a Web Vital metric
 */
function reportMetric(metric: PerformanceMetric): void {
  collectedMetrics.push(metric);
  
  if (metricsCallback) {
    metricsCallback(metric);
  }
  
  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vital] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`);
  }
}

/**
 * Initialize Web Vitals collection
 */
export async function initWebVitals(callback?: MetricCallback): Promise<void> {
  if (callback) {
    metricsCallback = callback;
  }
  
  if (typeof window === 'undefined') return;
  
  try {
    const webVitals = await import('web-vitals');
    const { onCLS, onFCP, onINP, onLCP, onTTFB } = webVitals;
    
    const handleMetric = (metric: { name: string; value: number; delta: number; id: string; navigationType: string }) => {
      reportMetric({
        name: metric.name,
        value: metric.value,
        rating: getRating(metric.name, metric.value),
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
      });
    };
    
    onCLS(handleMetric);
    onFCP(handleMetric);
    onINP(handleMetric);
    onLCP(handleMetric);
    onTTFB(handleMetric);
  } catch (error) {
    console.error('[Performance] Failed to initialize Web Vitals:', error);
  }
}

/**
 * Get collected metrics
 */
export function getCollectedMetrics(): PerformanceMetric[] {
  return [...collectedMetrics];
}

// ============================================
// Custom Performance Markers
// ============================================

const performanceMarks = new Map<string, number>();

/**
 * Start a performance measurement
 */
export function startMeasure(name: string): void {
  if (typeof performance === 'undefined') return;
  
  const markName = `${name}-start`;
  performance.mark(markName);
  performanceMarks.set(name, performance.now());
}

/**
 * End a performance measurement and get duration
 */
export function endMeasure(name: string): number | null {
  if (typeof performance === 'undefined') return null;
  
  const startTime = performanceMarks.get(name);
  if (!startTime) {
    console.warn(`[Performance] No start mark found for: ${name}`);
    return null;
  }
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  performanceMarks.delete(name);
  
  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
  }
  
  return duration;
}

/**
 * Measure async function execution time
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  startMeasure(name);
  try {
    const result = await fn();
    endMeasure(name);
    return result;
  } catch (error) {
    endMeasure(name);
    throw error;
  }
}

// ============================================
// Navigation Timing
// ============================================

interface NavigationTiming {
  dns: number;
  tcp: number;
  ssl: number;
  ttfb: number;
  download: number;
  domInteractive: number;
  domComplete: number;
  loadComplete: number;
}

/**
 * Get navigation timing metrics
 */
export function getNavigationTiming(): NavigationTiming | null {
  if (typeof window === 'undefined' || !window.performance) return null;
  
  const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (!timing) return null;
  
  return {
    dns: timing.domainLookupEnd - timing.domainLookupStart,
    tcp: timing.connectEnd - timing.connectStart,
    ssl: timing.secureConnectionStart > 0 
      ? timing.connectEnd - timing.secureConnectionStart 
      : 0,
    ttfb: timing.responseStart - timing.requestStart,
    download: timing.responseEnd - timing.responseStart,
    domInteractive: timing.domInteractive - timing.responseEnd,
    domComplete: timing.domComplete - timing.responseEnd,
    loadComplete: timing.loadEventEnd - timing.startTime,
  };
}

// ============================================
// Resource Timing
// ============================================

interface ResourceMetrics {
  totalResources: number;
  totalSize: number;
  byType: Record<string, { count: number; size: number; avgDuration: number }>;
  slowResources: Array<{ name: string; duration: number; size: number }>;
}

/**
 * Get resource timing metrics
 */
export function getResourceMetrics(): ResourceMetrics {
  if (typeof window === 'undefined' || !window.performance) {
    return {
      totalResources: 0,
      totalSize: 0,
      byType: {},
      slowResources: [],
    };
  }
  
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  
  const byType: Record<string, { count: number; size: number; totalDuration: number }> = {};
  let totalSize = 0;
  const slowResources: Array<{ name: string; duration: number; size: number }> = [];
  
  for (const resource of resources) {
    const type = getResourceType(resource.initiatorType);
    const size = resource.transferSize || 0;
    const duration = resource.duration;
    
    totalSize += size;
    
    if (!byType[type]) {
      byType[type] = { count: 0, size: 0, totalDuration: 0 };
    }
    
    byType[type].count++;
    byType[type].size += size;
    byType[type].totalDuration += duration;
    
    // Track slow resources (> 500ms)
    if (duration > 500) {
      slowResources.push({
        name: resource.name,
        duration,
        size,
      });
    }
  }
  
  // Calculate averages
  const byTypeWithAvg: Record<string, { count: number; size: number; avgDuration: number }> = {};
  for (const [type, data] of Object.entries(byType)) {
    byTypeWithAvg[type] = {
      count: data.count,
      size: data.size,
      avgDuration: data.totalDuration / data.count,
    };
  }
  
  return {
    totalResources: resources.length,
    totalSize,
    byType: byTypeWithAvg,
    slowResources: slowResources.sort((a, b) => b.duration - a.duration).slice(0, 10),
  };
}

function getResourceType(initiatorType: string): string {
  const typeMap: Record<string, string> = {
    'script': 'JavaScript',
    'css': 'CSS',
    'img': 'Images',
    'font': 'Fonts',
    'fetch': 'API',
    'xmlhttprequest': 'API',
    'other': 'Other',
  };
  return typeMap[initiatorType] || 'Other';
}

// ============================================
// Performance Observer
// ============================================

type PerformanceEntryHandler = (entries: PerformanceEntryList) => void;

/**
 * Create a performance observer
 */
export function createPerformanceObserver(
  entryTypes: string[],
  handler: PerformanceEntryHandler
): PerformanceObserver | null {
  if (typeof PerformanceObserver === 'undefined') return null;
  
  try {
    const observer = new PerformanceObserver((list) => {
      handler(list.getEntries());
    });
    
    observer.observe({ entryTypes });
    return observer;
  } catch (error) {
    console.error('[Performance] Observer error:', error);
    return null;
  }
}

// ============================================
// Long Task Detection
// ============================================

interface LongTask {
  duration: number;
  startTime: number;
  attribution: string;
}

const longTasks: LongTask[] = [];

/**
 * Start monitoring long tasks (> 50ms)
 */
export function monitorLongTasks(callback?: (task: LongTask) => void): void {
  if (typeof PerformanceObserver === 'undefined') return;
  
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const task: LongTask = {
          duration: entry.duration,
          startTime: entry.startTime,
          attribution: (entry as PerformanceEntry & { attribution?: { name: string }[] }).attribution?.[0]?.name || 'unknown',
        };
        
        longTasks.push(task);
        
        if (callback) {
          callback(task);
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[Performance] Long task detected: ${task.duration.toFixed(2)}ms`);
        }
      }
    });
    
    observer.observe({ entryTypes: ['longtask'] });
  } catch (error) {
    // Long task monitoring not supported
  }
}

/**
 * Get collected long tasks
 */
export function getLongTasks(): LongTask[] {
  return [...longTasks];
}

// ============================================
// Memory Usage (Chrome only)
// ============================================

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usagePercentage: number;
}

/**
 * Get memory usage (Chrome only)
 */
export function getMemoryUsage(): MemoryInfo | null {
  if (typeof window === 'undefined') return null;
  
  const memory = (performance as Performance & { memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  }}).memory;
  
  if (!memory) return null;
  
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
  };
}

// ============================================
// Performance Report
// ============================================

interface PerformanceReport {
  webVitals: PerformanceMetric[];
  navigation: NavigationTiming | null;
  resources: ResourceMetrics;
  longTasks: LongTask[];
  memory: MemoryInfo | null;
  timestamp: string;
}

/**
 * Generate a full performance report
 */
export function generatePerformanceReport(): PerformanceReport {
  return {
    webVitals: getCollectedMetrics(),
    navigation: getNavigationTiming(),
    resources: getResourceMetrics(),
    longTasks: getLongTasks(),
    memory: getMemoryUsage(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Send performance report to analytics
 */
export async function sendPerformanceReport(
  endpoint: string,
  additionalData?: Record<string, unknown>
): Promise<void> {
  const report = generatePerformanceReport();
  
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...report,
        ...additionalData,
        userAgent: navigator.userAgent,
        url: window.location.href,
      }),
      // Use sendBeacon for reliability
      keepalive: true,
    });
  } catch (error) {
    console.error('[Performance] Failed to send report:', error);
  }
}

export default {
  initWebVitals,
  getCollectedMetrics,
  startMeasure,
  endMeasure,
  measureAsync,
  getNavigationTiming,
  getResourceMetrics,
  createPerformanceObserver,
  monitorLongTasks,
  getLongTasks,
  getMemoryUsage,
  generatePerformanceReport,
  sendPerformanceReport,
};
