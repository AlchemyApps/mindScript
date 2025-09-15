/**
 * Performance monitoring utilities for Core Web Vitals and custom metrics
 */

interface PerformanceMetrics {
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
  INP?: number; // Interaction to Next Paint
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private reportUrl: string | null = null;

  constructor(reportUrl?: string) {
    this.reportUrl = reportUrl || null;
    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    if (typeof window === 'undefined') return;

    // Monitor Core Web Vitals
    this.observeLCP();
    this.observeFID();
    this.observeCLS();
    this.observeFCP();
    this.observeTTFB();
    this.observeINP();

    // Send metrics on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.reportMetrics());
    }
  }

  private observeLCP() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        this.metrics.LCP = lastEntry.renderTime || lastEntry.loadTime;
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      console.warn('LCP observation not supported');
    }
  }

  private observeFID() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const firstEntry = entries[0] as any;
        this.metrics.FID = firstEntry.processingStart - firstEntry.startTime;
      });
      observer.observe({ type: 'first-input', buffered: true });
    } catch (e) {
      console.warn('FID observation not supported');
    }
  }

  private observeCLS() {
    if (!('PerformanceObserver' in window)) return;

    let clsValue = 0;
    let clsEntries: any[] = [];

    const sessionValue = 0;
    const sessionEntries: any[] = [];

    try {
      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            const firstSessionEntry = sessionEntries[0];
            const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

            if (
              sessionValue &&
              entry.startTime - lastSessionEntry.startTime < 1000 &&
              entry.startTime - firstSessionEntry.startTime < 5000
            ) {
              clsValue += entry.value;
              sessionEntries.push(entry);
            } else {
              clsValue = entry.value;
              sessionEntries.length = 0;
              sessionEntries.push(entry);
            }

            if (clsValue > this.metrics.CLS!) {
              this.metrics.CLS = clsValue;
              clsEntries = [...sessionEntries];
            }
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      console.warn('CLS observation not supported');
    }
  }

  private observeFCP() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const fcpEntry = entries.find((entry) => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          this.metrics.FCP = fcpEntry.startTime;
        }
      });
      observer.observe({ type: 'paint', buffered: true });
    } catch (e) {
      console.warn('FCP observation not supported');
    }
  }

  private observeTTFB() {
    if (typeof window === 'undefined') return;

    try {
      const navigationTiming = performance.getEntriesByType('navigation')[0] as any;
      if (navigationTiming) {
        this.metrics.TTFB = navigationTiming.responseStart - navigationTiming.fetchStart;
      }
    } catch (e) {
      console.warn('TTFB measurement not supported');
    }
  }

  private observeINP() {
    if (!('PerformanceObserver' in window)) return;

    let inpValue = 0;
    const eventEntries: any[] = [];

    try {
      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries() as any[]) {
          if (entry.interactionId) {
            eventEntries.push(entry);
            const inp = Math.max(...eventEntries.map((e) => e.duration));
            if (inp > inpValue) {
              inpValue = inp;
              this.metrics.INP = inp;
            }
          }
        }
      });
      observer.observe({ type: 'event', buffered: true });
    } catch (e) {
      console.warn('INP observation not supported');
    }
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public reportMetrics() {
    if (!this.reportUrl) {
      console.log('Performance Metrics:', this.metrics);
      return;
    }

    // Send metrics to analytics endpoint
    const body = JSON.stringify({
      metrics: this.metrics,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    });

    // Use sendBeacon for reliable delivery
    if ('sendBeacon' in navigator) {
      navigator.sendBeacon(this.reportUrl, body);
    } else {
      // Fallback to fetch
      fetch(this.reportUrl, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {});
    }
  }

  // Custom metric tracking
  public trackCustomMetric(name: string, value: number) {
    if (typeof window === 'undefined') return;

    performance.mark(`${name}-start`);
    setTimeout(() => {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    }, value);
  }
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null;

export function initPerformanceMonitoring(reportUrl?: string): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor(reportUrl);
  }
  return performanceMonitor;
}

export function getPerformanceMetrics(): PerformanceMetrics {
  if (performanceMonitor) {
    return performanceMonitor.getMetrics();
  }
  return {};
}

// Helper to measure component render time
export function measureComponentPerformance(componentName: string) {
  return {
    onRenderStart: () => performance.mark(`${componentName}-render-start`),
    onRenderEnd: () => {
      performance.mark(`${componentName}-render-end`);
      performance.measure(
        `${componentName}-render`,
        `${componentName}-render-start`,
        `${componentName}-render-end`
      );
    },
  };
}