import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccessibilityTester } from '../AccessibilityTester';

// Mock the accessibility utilities
jest.mock('../../../lib/accessibility-utils', () => ({
  accessibilityTesting: {
    runAccessibilityCheck: jest.fn()
  }
}));

import { accessibilityTesting } from '../../../lib/accessibility-utils';

const mockAccessibilityCheck = {
  hasProperARIA: true,
  isKeyboardAccessible: true,
  hasProperContrast: true,
  issues: []
};

const mockAccessibilityCheckWithIssues = {
  hasProperARIA: false,
  isKeyboardAccessible: false,
  hasProperContrast: false,
  issues: ['Missing ARIA labels', 'Not keyboard accessible', 'Insufficient contrast']
};

describe('AccessibilityTester', () => {
  beforeEach(() => {
    (accessibilityTesting.runAccessibilityCheck as jest.Mock).mockReturnValue(mockAccessibilityCheck);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<AccessibilityTester />);
    expect(screen.getByText('Accessibility Tester')).toBeInTheDocument();
  });

  it('shows start button when not running', () => {
    render(<AccessibilityTester />);
    expect(screen.getByText('Run Test')).toBeInTheDocument();
    expect(screen.queryByText('Testing...')).not.toBeInTheDocument();
  });

  it('starts testing when run button is clicked', async () => {
    render(<AccessibilityTester />);
    
    const runButton = screen.getByText('Run Test');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      expect(screen.getByText('Testing...')).toBeInTheDocument();
    });
  });

  it('shows test results after testing completes', async () => {
    render(<AccessibilityTester showDetails={true} />);
    
    const runButton = screen.getByText('Run Test');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      expect(screen.getByText('Total Issues')).toBeInTheDocument();
      expect(screen.getByText('Errors')).toBeInTheDocument();
      expect(screen.getByText('Warnings')).toBeInTheDocument();
      expect(screen.getByText('Passed')).toBeInTheDocument();
    });
  });

  it('shows no issues message when no issues found', async () => {
    render(<AccessibilityTester showDetails={true} />);
    
    const runButton = screen.getByText('Run Test');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      expect(screen.getByText('No accessibility issues found!')).toBeInTheDocument();
    });
  });

  it('shows issues when problems are found', async () => {
    (accessibilityTesting.runAccessibilityCheck as jest.Mock).mockReturnValue(mockAccessibilityCheckWithIssues);
    
    render(<AccessibilityTester showDetails={true} />);
    
    const runButton = screen.getByText('Run Test');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      expect(screen.getByText('Issues Found')).toBeInTheDocument();
      expect(screen.getByText('Missing ARIA labels')).toBeInTheDocument();
      expect(screen.getByText('Not keyboard accessible')).toBeInTheDocument();
      expect(screen.getByText('Insufficient contrast')).toBeInTheDocument();
    });
  });

  it('toggles details visibility', () => {
    render(<AccessibilityTester />);
    
    const showDetailsButton = screen.getByText('Show Details');
    fireEvent.click(showDetailsButton);
    
    expect(screen.getByText('Hide Details')).toBeInTheDocument();
    
    const hideDetailsButton = screen.getByText('Hide Details');
    fireEvent.click(hideDetailsButton);
    
    expect(screen.getByText('Show Details')).toBeInTheDocument();
  });

  it('shows details by default when showDetails prop is true', () => {
    render(<AccessibleTester showDetails={true} />);
    expect(screen.getByText('Hide Details')).toBeInTheDocument();
  });

  it('displays correct issue counts', async () => {
    (accessibilityTesting.runAccessibilityCheck as jest.Mock).mockReturnValue(mockAccessibilityCheckWithIssues);
    
    render(<AccessibilityTester showDetails={true} />);
    
    const runButton = screen.getByText('Run Test');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // Total issues
      expect(screen.getByText('3')).toBeInTheDocument(); // Errors
      expect(screen.getByText('0')).toBeInTheDocument(); // Warnings
      expect(screen.getByText('0')).toBeInTheDocument(); // Passed
    });
  });

  it('handles testing errors gracefully', async () => {
    (accessibilityTesting.runAccessibilityCheck as jest.Mock).mockImplementation(() => {
      throw new Error('Testing failed');
    });
    
    render(<AccessibilityTester showDetails={true} />);
    
    const runButton = screen.getByText('Run Test');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      // Should still render without crashing
      expect(screen.getByText('Run Test')).toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    const className = 'custom-accessibility-tester';
    const { container } = render(
      <AccessibilityTester className={className} />
    );
    expect(container.firstChild).toHaveClass(className);
  });

  it('shows issue severity badges', async () => {
    (accessibilityTesting.runAccessibilityCheck as jest.Mock).mockReturnValue(mockAccessibilityCheckWithIssues);
    
    render(<AccessibilityTester showDetails={true} />);
    
    const runButton = screen.getByText('Run Test');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      expect(screen.getByText('error')).toBeInTheDocument();
    });
  });

  it('shows issue type icons', async () => {
    (accessibilityTesting.runAccessibilityCheck as jest.Mock).mockReturnValue(mockAccessibilityCheckWithIssues);
    
    render(<AccessibilityTester showDetails={true} />);
    
    const runButton = screen.getByText('Run Test');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      expect(screen.getByText('🏷️')).toBeInTheDocument(); // ARIA icon
      expect(screen.getByText('⌨️')).toBeInTheDocument(); // Keyboard icon
      expect(screen.getByText('🎨')).toBeInTheDocument(); // Contrast icon
    });
  });

  it('shows recommendations for issues', async () => {
    (accessibilityTesting.runAccessibilityCheck as jest.Mock).mockReturnValue(mockAccessibilityCheckWithIssues);
    
    render(<AccessibilityTester showDetails={true} />);
    
    const runButton = screen.getByText('Run Test');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      expect(screen.getByText('Add appropriate ARIA labels, roles, and properties')).toBeInTheDocument();
      expect(screen.getByText('Ensure element can be focused and activated with keyboard')).toBeInTheDocument();
      expect(screen.getByText('Improve color contrast to meet WCAG AA standards')).toBeInTheDocument();
    });
  });

  it('handles empty issues array', async () => {
    (accessibilityTesting.runAccessibilityCheck as jest.Mock).mockReturnValue({
      hasProperARIA: true,
      isKeyboardAccessible: true,
      hasProperContrast: true,
      issues: []
    });
    
    render(<AccessibilityTester showDetails={true} />);
    
    const runButton = screen.getByText('Run Test');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      expect(screen.getByText('No accessibility issues found!')).toBeInTheDocument();
    });
  });

  it('calls accessibility testing for all elements', async () => {
    render(<AccessibilityTester showDetails={true} />);
    
    const runButton = screen.getByText('Run Test');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      // Should call runAccessibilityCheck for each element
      expect(accessibilityTesting.runAccessibilityCheck).toHaveBeenCalled();
    });
  });
});

