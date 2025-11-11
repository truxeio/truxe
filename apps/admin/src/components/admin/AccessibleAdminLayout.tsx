import React, { useState, useCallback, useEffect } from 'react';
import { useAccessibility, useFocusTrap, useKeyboardNavigation } from '../../lib/accessibility-utils';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Breadcrumb } from './Breadcrumb';
import { AccessibilityTester } from './AccessibilityTester';
import { Button } from '../ui/Button';
import { Badge } from './Badge';

interface AccessibleAdminLayoutProps {
  children: React.ReactNode;
  currentRoute?: string;
  onRouteChange?: (route: string) => void;
  showAccessibilityTester?: boolean;
  className?: string;
}

export const AccessibleAdminLayout: React.FC<AccessibleAdminLayoutProps> = ({
  children,
  currentRoute = '/dashboard',
  onRouteChange,
  showAccessibilityTester = false,
  className = ''
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAccessibilityTesterOpen, setIsAccessibilityTesterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(currentRoute);
  
  const { announce, announcePageChange } = useAccessibility();
  const sidebarRef = useFocusTrap(isSidebarOpen);
  const accessibilityTesterRef = useFocusTrap(isAccessibilityTesterOpen);

  // Keyboard navigation for sidebar
  useKeyboardNavigation(useCallback((direction) => {
    if (direction === 'left' && !isSidebarOpen) {
      setIsSidebarOpen(true);
      announce('Sidebar opened', 'polite');
    } else if (direction === 'right' && isSidebarOpen) {
      setIsSidebarOpen(false);
      announce('Sidebar closed', 'polite');
    }
  }, [isSidebarOpen, announce]));

  // Handle route changes with accessibility announcements
  const handleRouteChange = useCallback((route: string) => {
    setCurrentPage(route);
    onRouteChange?.(route);
    
    // Announce page change to screen readers
    const pageNames: Record<string, string> = {
      '/dashboard': 'Dashboard',
      '/users': 'User Management',
      '/security': 'Security Monitoring',
      '/settings': 'Settings',
      '/reports': 'Reports'
    };
    
    const pageName = pageNames[route] || route;
    announcePageChange(`${pageName} - Admin Dashboard`);
  }, [onRouteChange, announcePageChange]);

  // Handle sidebar toggle
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => {
      const newState = !prev;
      announce(newState ? 'Sidebar opened' : 'Sidebar closed', 'polite');
      return newState;
    });
  }, [announce]);

  // Handle accessibility tester toggle
  const toggleAccessibilityTester = useCallback(() => {
    setIsAccessibilityTesterOpen(prev => {
      const newState = !prev;
      announce(newState ? 'Accessibility tester opened' : 'Accessibility tester closed', 'polite');
      return newState;
    });
  }, [announce]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isAccessibilityTesterOpen) {
          setIsAccessibilityTesterOpen(false);
          announce('Accessibility tester closed', 'polite');
        } else if (isSidebarOpen) {
          setIsSidebarOpen(false);
          announce('Sidebar closed', 'polite');
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSidebarOpen, isAccessibilityTesterOpen, announce]);

  // Skip to main content link
  const skipToMainContent = useCallback(() => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.focus();
      announce('Skipped to main content', 'polite');
    }
  }, [announce]);

  return (
    <div className={`accessible-admin-layout ${className}`}>
      {/* Skip to main content link */}
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          skipToMainContent();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Accessibility Tester Toggle */}
      {showAccessibilityTester && (
        <div className="fixed top-4 right-4 z-40">
          <Button
            onClick={toggleAccessibilityTester}
            variant="outline"
            size="sm"
            aria-label="Toggle accessibility tester"
          >
            <span className="mr-2">♿</span>
            Accessibility
          </Button>
        </div>
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:inset-0`}
        role="navigation"
        aria-label="Main navigation"
      >
        <Sidebar
          currentRoute={currentPage}
          onRouteChange={handleRouteChange}
          onClose={() => setIsSidebarOpen(false)}
        />
      </aside>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        {/* Top bar */}
        <header
          className="bg-white shadow-sm border-b border-gray-200"
          role="banner"
        >
          <TopBar
            onMenuClick={toggleSidebar}
            currentRoute={currentPage}
            showMenuButton={true}
          />
        </header>

        {/* Breadcrumb */}
        <nav
          className="bg-gray-50 px-4 py-2 border-b border-gray-200"
          aria-label="Breadcrumb"
        >
          <Breadcrumb
            items={[
              { label: 'Admin', path: '/admin', href: '/admin' },
              { label: currentPage.replace('/', '').replace('-', ' '), path: currentPage, href: currentPage }
            ]}
          />
        </nav>

        {/* Main content */}
        <main
          id="main-content"
          className="flex-1 p-6 focus:outline-none"
          role="main"
          tabIndex={-1}
        >
          {children}
        </main>

        {/* Footer */}
        <footer
          className="bg-gray-50 px-6 py-4 border-t border-gray-200"
          role="contentinfo"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              © 2024 Truxe Admin Dashboard. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <Badge color="green">WCAG 2.1 AA Compliant</Badge>
              <Badge color="blue">Keyboard Accessible</Badge>
            </div>
          </div>
        </footer>
      </div>

      {/* Accessibility Tester Modal */}
      {isAccessibilityTesterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="accessibility-tester-title"
        >
          <div
            ref={accessibilityTesterRef as React.RefObject<HTMLDivElement>}
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 id="accessibility-tester-title" className="text-xl font-semibold">
                  Accessibility Tester
                </h2>
                <Button
                  onClick={() => setIsAccessibilityTesterOpen(false)}
                  variant="outline"
                  size="sm"
                  aria-label="Close accessibility tester"
                >
                  ✕
                </Button>
              </div>
              <AccessibilityTester showDetails={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessibleAdminLayout;

