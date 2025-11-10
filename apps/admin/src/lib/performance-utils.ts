/**
 * Performance Utilities for Truxe Admin Dashboard
 * 
 * This file contains utilities for performance optimization including
 * lazy loading, memoization, and performance monitoring.
 */

import React, { lazy, ComponentType, Suspense } from 'react';

// Lazy loading utilities
export function createLazyComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) {
  const LazyComponent = lazy(importFunc);
  
  return function WrappedLazyComponent(props: React.ComponentProps<T>) {
    const FallbackComponent = fallback || (() => React.createElement('div', null, 'Loading...'));
    
    return React.createElement(
      Suspense,
      { fallback: React.createElement(FallbackComponent) },
      React.createElement(LazyComponent, props)
    );
  };
}

// Preload utilities
export function preloadComponent(importFunc: () => Promise<any>) {
  return () => {
    importFunc().catch(console.error);
  };
}

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): T {
  let timeout: NodeJS.Timeout | null = null;
  
  return ((...args: Parameters<T>) => {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  }) as T;
}

// Throttle utility
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean;
  
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  }) as T;
}

// Memoization utility
export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map();
  
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number> = new Map();
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }
  
  startTiming(name: string): void {
    this.metrics.set(name, performance.now());
  }
  
  endTiming(name: string): number {
    const startTime = this.metrics.get(name);
    if (!startTime) {
      console.warn(`No start time found for ${name}`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.metrics.delete(name);
    return duration;
  }
  
  measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startTiming(name);
    return fn().finally(() => {
      const duration = this.endTiming(name);
      console.log(`${name} took ${duration.toFixed(2)}ms`);
    });
  }
  
  measure<T>(name: string, fn: () => T): T {
    this.startTiming(name);
    const result = fn();
    const duration = this.endTiming(name);
    console.log(`${name} took ${duration.toFixed(2)}ms`);
    return result;
  }
}

// Performance metrics interface
export interface PerformanceMetrics {
  loadTime: number;
  bundleSize: number;
  memoryUsage: number;
  cacheHitRate: number;
  renderTime: number;
}

// Performance optimization config
export interface PerformanceOptimizationConfig {
  enableLazyLoading: boolean;
  enableCodeSplitting: boolean;
  enableCaching: boolean;
  enablePreloading: boolean;
}

// Performance measurement functions
export function measurePerformance(): PerformanceMetrics {
  const loadTime = performance.now();
  const memoryUsage = getMemoryUsage().used;
  
  return {
    loadTime,
    bundleSize: 0, // Will be set by build process
    memoryUsage,
    cacheHitRate: 0.8, // Default value
    renderTime: 0
  };
}

export function getPerformanceMetrics(): PerformanceMetrics {
  return measurePerformance();
}

// Performance optimization hook
export function usePerformanceOptimization() {
  const [isOptimized, setIsOptimized] = React.useState(false);
  
  const enableOptimizations = React.useCallback(() => {
    setIsOptimized(true);
  }, []);
  
  const disableOptimizations = React.useCallback(() => {
    setIsOptimized(false);
  }, []);
  
  const getOptimizationStatus = React.useCallback(() => {
    return { isOptimized };
  }, [isOptimized]);
  
  return {
    isOptimized,
    enableOptimizations,
    disableOptimizations,
    getOptimizationStatus
  };
}

// Bundle size monitoring
export class BundleSizeMonitor {
  private static instance: BundleSizeMonitor;
  private sizes: Map<string, number> = new Map();
  
  static getInstance(): BundleSizeMonitor {
    if (!BundleSizeMonitor.instance) {
      BundleSizeMonitor.instance = new BundleSizeMonitor();
    }
    return BundleSizeMonitor.instance;
  }
  
  trackComponent(name: string, size: number): void {
    this.sizes.set(name, size);
    console.log(`Component ${name} size: ${size} bytes`);
  }
  
  getTotalSize(): number {
    return Array.from(this.sizes.values()).reduce((total, size) => total + size, 0);
  }
  
  getLargestComponents(count = 5): Array<{ name: string; size: number }> {
    return Array.from(this.sizes.entries())
      .map(([name, size]) => ({ name, size }))
      .sort((a, b) => b.size - a.size)
      .slice(0, count);
  }
}

// Image optimization
export function optimizeImage(
  src: string,
  width?: number,
  height?: number,
  quality = 80
): string {
  // In a real implementation, this would use an image optimization service
  // like Cloudinary, ImageKit, or Next.js Image Optimization
  const params = new URLSearchParams();
  
  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  params.set('q', quality.toString());
  params.set('f', 'webp'); // Use WebP format for better compression
  
  return `${src}?${params.toString()}`;
}

// Resource preloading
export function preloadResource(href: string, as: string): void {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  document.head.appendChild(link);
}

export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

// Virtual scrolling utilities
export interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export function calculateVirtualScrollRange(
  scrollTop: number,
  options: VirtualScrollOptions
): { start: number; end: number; totalHeight: number } {
  const { itemHeight, containerHeight, overscan = 5 } = options;
  
  const start = Math.floor(scrollTop / itemHeight);
  const end = Math.min(
    start + Math.ceil(containerHeight / itemHeight) + overscan,
    Math.ceil(scrollTop / itemHeight) + Math.ceil(containerHeight / itemHeight) + overscan
  );
  
  return {
    start: Math.max(0, start - overscan),
    end,
    totalHeight: itemHeight * Math.ceil(scrollTop / itemHeight) + containerHeight
  };
}

// Intersection Observer for lazy loading
export function createIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  };
  
  return new IntersectionObserver(callback, defaultOptions);
}

// Web Vitals monitoring
export function measureWebVitals(): void {
  // First Contentful Paint
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'first-contentful-paint') {
        console.log('FCP:', entry.startTime);
      }
    }
  }).observe({ entryTypes: ['paint'] });
  
  // Largest Contentful Paint
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log('LCP:', entry.startTime);
    }
  }).observe({ entryTypes: ['largest-contentful-paint'] });
  
  // First Input Delay
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log('FID:', entry.processingStart - entry.startTime);
    }
  }).observe({ entryTypes: ['first-input'] });
  
  // Cumulative Layout Shift
  let clsValue = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!(entry as any).hadRecentInput) {
        clsValue += (entry as any).value;
      }
    }
    console.log('CLS:', clsValue);
  }).observe({ entryTypes: ['layout-shift'] });
}

// Memory usage monitoring
export function getMemoryUsage(): {
  used: number;
  total: number;
  percentage: number;
} {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
    };
  }
  
  return { used: 0, total: 0, percentage: 0 };
}

// Performance budget monitoring
export class PerformanceBudget {
  private static instance: PerformanceBudget;
  private budgets: Map<string, number> = new Map();
  
  static getInstance(): PerformanceBudget {
    if (!PerformanceBudget.instance) {
      PerformanceBudget.instance = new PerformanceBudget();
    }
    return PerformanceBudget.instance;
  }
  
  setBudget(metric: string, budget: number): void {
    this.budgets.set(metric, budget);
  }
  
  checkBudget(metric: string, value: number): boolean {
    const budget = this.budgets.get(metric);
    if (!budget) return true;
    
    const withinBudget = value <= budget;
    if (!withinBudget) {
      console.warn(`Performance budget exceeded for ${metric}: ${value}ms > ${budget}ms`);
    }
    
    return withinBudget;
  }
  
  // Set default budgets
  setDefaultBudgets(): void {
    this.setBudget('fcp', 1800); // First Contentful Paint
    this.setBudget('lcp', 2500); // Largest Contentful Paint
    this.setBudget('fid', 100);  // First Input Delay
    this.setBudget('cls', 0.1);  // Cumulative Layout Shift
  }
}

// Export all utilities
export const performanceUtils = {
  createLazyComponent,
  preloadComponent,
  debounce,
  throttle,
  memoize,
  PerformanceMonitor,
  BundleSizeMonitor,
  optimizeImage,
  preloadResource,
  preloadImage,
  calculateVirtualScrollRange,
  createIntersectionObserver,
  measureWebVitals,
  getMemoryUsage,
  PerformanceBudget,
} as const;

export default performanceUtils;

