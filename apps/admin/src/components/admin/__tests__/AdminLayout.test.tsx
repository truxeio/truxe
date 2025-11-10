import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminLayout } from '../AdminLayout';

// Mock the Sidebar and TopBar components
jest.mock('../Sidebar', () => {
  return function MockSidebar({ currentRoute, onRouteChange, onClose }: any) {
    return (
      <div data-testid="sidebar">
        <button onClick={() => onRouteChange?.('/test-route')}>Test Route</button>
        <button onClick={() => onClose?.()}>Close</button>
      </div>
    );
  };
});

jest.mock('../TopBar', () => {
  return function MockTopBar({ onMenuClick, currentRoute, showMenuButton }: any) {
    return (
      <div data-testid="topbar">
        <button onClick={onMenuClick}>Menu</button>
        <span data-testid="current-route">{currentRoute}</span>
      </div>
    );
  };
});

describe('AdminLayout', () => {
  const defaultProps = {
    children: <div data-testid="main-content">Test Content</div>
  };

  it('renders without crashing', () => {
    render(<AdminLayout {...defaultProps} />);
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
  });

  it('renders sidebar and topbar', () => {
    render(<AdminLayout {...defaultProps} />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
  });

  it('passes currentRoute to sidebar and topbar', () => {
    const currentRoute = '/dashboard';
    render(<AdminLayout {...defaultProps} currentRoute={currentRoute} />);
    expect(screen.getByTestId('current-route')).toHaveTextContent(currentRoute);
  });

  it('calls onRouteChange when route changes', () => {
    const onRouteChange = jest.fn();
    render(<AdminLayout {...defaultProps} onRouteChange={onRouteChange} />);
    
    fireEvent.click(screen.getByText('Test Route'));
    expect(onRouteChange).toHaveBeenCalledWith('/test-route');
  });

  it('applies custom className', () => {
    const className = 'custom-class';
    const { container } = render(
      <AdminLayout {...defaultProps} className={className} />
    );
    expect(container.firstChild).toHaveClass(className);
  });

  it('renders children in main content area', () => {
    const children = <div data-testid="custom-content">Custom Content</div>;
    render(<AdminLayout children={children} />);
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
  });

  it('handles missing onRouteChange gracefully', () => {
    render(<AdminLayout {...defaultProps} />);
    expect(() => {
      fireEvent.click(screen.getByText('Test Route'));
    }).not.toThrow();
  });

  it('handles missing onClose gracefully', () => {
    render(<AdminLayout {...defaultProps} />);
    expect(() => {
      fireEvent.click(screen.getByText('Close'));
    }).not.toThrow();
  });
});

