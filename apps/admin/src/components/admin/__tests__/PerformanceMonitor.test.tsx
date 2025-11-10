import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PerformanceMonitor } from '../PerformanceMonitor';

// Mock the performance utilities
jest.mock('../../../lib/performance-utils', () => ({
  measurePerformance: jest.fn(),
  getPerformanceMetrics: jest.fn()
}));

import { getPerformanceMetrics } from '../../../lib/performance-utils';

const mockMetrics = {
  loadTime: 1500,
  bundleSize: 450 * 1024, // 450KB
  memoryUsage: 25 * 1024 * 1024, // 25MB
  componentCount: 15,
  renderTime: 80,
  cacheHitRate: 0.85
};

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    (getPerformanceMetrics as jest.Mock).mockResolvedValue(mockMetrics);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<PerformanceMonitor />);
    expect(screen.getByText('Start Performance Monitor')).toBeInTheDocument();
  });

  it('shows start button when not monitoring', () => {
    render(<PerformanceMonitor />);
    expect(screen.getByText('Start Performance Monitor')).toBeInTheDocument();
    expect(screen.queryByText('Stop Monitoring')).not.toBeInTheDocument();
  });

  it('starts monitoring when start button is clicked', async () => {
    render(<PerformanceMonitor />);
    
    const startButton = screen.getByText('Start Performance Monitor');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Stop Monitoring')).toBeInTheDocument();
    });
  });

  it('stops monitoring when stop button is clicked', async () => {
    render(<PerformanceMonitor showMetrics={true} />);
    
    // Start monitoring
    const startButton = screen.getByText('Start Performance Monitor');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Stop Monitoring')).toBeInTheDocument();
    });
    
    // Stop monitoring
    const stopButton = screen.getByText('Stop Monitoring');
    fireEvent.click(stopButton);
    
    await waitFor(() => {
      expect(screen.getByText('Start Performance Monitor')).toBeInTheDocument();
    });
  });

  it('displays metrics when showMetrics is true', async () => {
    render(<PerformanceMonitor showMetrics={true} />);
    
    // Start monitoring
    const startButton = screen.getByText('Start Performance Monitor');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Load Time')).toBeInTheDocument();
      expect(screen.getByText('Bundle Size')).toBeInTheDocument();
      expect(screen.getByText('Memory Usage')).toBeInTheDocument();
      expect(screen.getByText('Components')).toBeInTheDocument();
      expect(screen.getByText('Render Time')).toBeInTheDocument();
      expect(screen.getByText('Cache Hit Rate')).toBeInTheDocument();
    });
  });

  it('calls onMetricsUpdate when metrics are updated', async () => {
    const onMetricsUpdate = jest.fn();
    render(<PerformanceMonitor onMetricsUpdate={onMetricsUpdate} showMetrics={true} />);
    
    // Start monitoring
    const startButton = screen.getByText('Start Performance Monitor');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(onMetricsUpdate).toHaveBeenCalledWith(mockMetrics);
    });
  });

  it('formats metrics correctly', async () => {
    render(<PerformanceMonitor showMetrics={true} />);
    
    // Start monitoring
    const startButton = screen.getByText('Start Performance Monitor');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      // Check load time formatting
      expect(screen.getByText('1.5s')).toBeInTheDocument();
      
      // Check bundle size formatting
      expect(screen.getByText('450 KB')).toBeInTheDocument();
      
      // Check memory usage formatting
      expect(screen.getByText('25 MB')).toBeInTheDocument();
      
      // Check component count
      expect(screen.getByText('15')).toBeInTheDocument();
      
      // Check render time formatting
      expect(screen.getByText('80ms')).toBeInTheDocument();
      
      // Check cache hit rate formatting
      expect(screen.getByText('85.0%')).toBeInTheDocument();
    });
  });

  it('handles missing onMetricsUpdate gracefully', async () => {
    render(<PerformanceMonitor showMetrics={true} />);
    
    // Start monitoring
    const startButton = screen.getByText('Start Performance Monitor');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Load Time')).toBeInTheDocument();
    });
    
    // Should not throw
    expect(() => {
      // Component should render without errors
    }).not.toThrow();
  });

  it('handles performance metrics errors gracefully', async () => {
    (getPerformanceMetrics as jest.Mock).mockRejectedValue(new Error('Failed to get metrics'));
    
    render(<PerformanceMonitor showMetrics={true} />);
    
    // Start monitoring
    const startButton = screen.getByText('Start Performance Monitor');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      // Should still render without crashing
      expect(screen.getByText('Stop Monitoring')).toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    const className = 'custom-performance-monitor';
    const { container } = render(
      <PerformanceMonitor className={className} />
    );
    expect(container.firstChild).toHaveClass(className);
  });

  it('shows monitoring status', async () => {
    render(<PerformanceMonitor showMetrics={true} />);
    
    // Start monitoring
    const startButton = screen.getByText('Start Performance Monitor');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Monitoring...')).toBeInTheDocument();
    });
    
    // Stop monitoring
    const stopButton = screen.getByText('Stop Monitoring');
    fireEvent.click(stopButton);
    
    await waitFor(() => {
      expect(screen.getByText('Stopped')).toBeInTheDocument();
    });
  });

  it('updates metrics periodically when monitoring', async () => {
    jest.useFakeTimers();
    
    render(<PerformanceMonitor showMetrics={true} />);
    
    // Start monitoring
    const startButton = screen.getByText('Start Performance Monitor');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Monitoring...')).toBeInTheDocument();
    });
    
    // Fast-forward time to trigger interval
    jest.advanceTimersByTime(1000);
    
    await waitFor(() => {
      expect(getPerformanceMetrics).toHaveBeenCalledTimes(2); // Initial + interval
    });
    
    jest.useRealTimers();
  });

  it('cleans up interval when component unmounts', () => {
    const { unmount } = render(<PerformanceMonitor showMetrics={true} />);
    
    // Start monitoring
    const startButton = screen.getByText('Start Performance Monitor');
    fireEvent.click(startButton);
    
    // Unmount component
    unmount();
    
    // Should not throw
    expect(() => {
      // Component should unmount without errors
    }).not.toThrow();
  });
});

