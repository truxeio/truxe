import React, { useState, useCallback, useRef, useEffect } from 'react';
import { accessibilityTesting, useAccessibility } from '../../lib/accessibility-utils';
import { Button } from '../ui/Button';
import { Card } from './Card';
import { Badge } from './Badge';

interface AccessibilityTesterProps {
  className?: string;
  showDetails?: boolean;
}

interface AccessibilityIssue {
  element: string;
  type: 'aria' | 'keyboard' | 'contrast';
  severity: 'error' | 'warning' | 'info';
  message: string;
  recommendation: string;
}

export const AccessibilityTester: React.FC<AccessibilityTesterProps> = ({
  className = '',
  showDetails = false
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [issues, setIssues] = useState<AccessibilityIssue[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    errors: 0,
    warnings: 0,
    passed: 0
  });
  const [isExpanded, setIsExpanded] = useState(showDetails);
  
  const { announce } = useAccessibility();
  const containerRef = useRef<HTMLDivElement>(null);

  const runAccessibilityTest = useCallback(async () => {
    if (!containerRef.current) return;

    setIsRunning(true);
    setIssues([]);
    announce('Starting accessibility test', 'polite');

    const allElements = containerRef.current.querySelectorAll('*');
    const foundIssues: AccessibilityIssue[] = [];

    allElements.forEach((element, index) => {
      const htmlElement = element as HTMLElement;
      const check = accessibilityTesting.runAccessibilityCheck(htmlElement);

      if (!check.hasProperARIA) {
        foundIssues.push({
          element: htmlElement.tagName.toLowerCase(),
          type: 'aria',
          severity: 'error',
          message: 'Missing or improper ARIA attributes',
          recommendation: 'Add appropriate ARIA labels, roles, and properties'
        });
      }

      if (!check.isKeyboardAccessible) {
        foundIssues.push({
          element: htmlElement.tagName.toLowerCase(),
          type: 'keyboard',
          severity: 'warning',
          message: 'Not keyboard accessible',
          recommendation: 'Ensure element can be focused and activated with keyboard'
        });
      }

      if (!check.hasProperContrast) {
        foundIssues.push({
          element: htmlElement.tagName.toLowerCase(),
          type: 'contrast',
          severity: 'error',
          message: 'Insufficient color contrast',
          recommendation: 'Improve color contrast to meet WCAG AA standards'
        });
      }
    });

    // Calculate summary
    const errors = foundIssues.filter(issue => issue.severity === 'error').length;
    const warnings = foundIssues.filter(issue => issue.severity === 'warning').length;
    const total = foundIssues.length;
    const passed = allElements.length - total;

    setIssues(foundIssues);
    setSummary({ total, errors, warnings, passed });
    setIsRunning(false);

    // Announce results
    if (total === 0) {
      announce('Accessibility test passed with no issues', 'polite');
    } else {
      announce(`Accessibility test found ${total} issues: ${errors} errors, ${warnings} warnings`, 'assertive');
    }
  }, [announce]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'red';
      case 'warning': return 'yellow';
      case 'info': return 'blue';
      default: return 'gray';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'aria': return '🏷️';
      case 'keyboard': return '⌨️';
      case 'contrast': return '🎨';
      default: return '❓';
    }
  };

  useEffect(() => {
    // Auto-run test on mount if showDetails is true
    if (showDetails) {
      runAccessibilityTest();
    }
  }, [showDetails, runAccessibilityTest]);

  return (
    <div ref={containerRef} className={`accessibility-tester ${className}`}>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Accessibility Tester
          </h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={runAccessibilityTest}
              disabled={isRunning}
              variant="primary"
              size="sm"
            >
              {isRunning ? 'Testing...' : 'Run Test'}
            </Button>
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              variant="outline"
              size="sm"
            >
              {isExpanded ? 'Hide Details' : 'Show Details'}
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
            <div className="text-sm text-gray-600">Total Issues</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
            <div className="text-sm text-gray-600">Errors</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{summary.warnings}</div>
            <div className="text-sm text-gray-600">Warnings</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
            <div className="text-sm text-gray-600">Passed</div>
          </div>
        </div>

        {/* Issues List */}
        {isExpanded && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Issues Found</h4>
            {issues.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">✅</div>
                <p>No accessibility issues found!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {issues.map((issue, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="text-lg">{getTypeIcon(issue.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge color={getSeverityColor(issue.severity)}>
                          {issue.severity}
                        </Badge>
                        <span className="text-sm font-medium text-gray-700">
                          {issue.element}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{issue.message}</p>
                      <p className="text-xs text-gray-500">{issue.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AccessibilityTester;

