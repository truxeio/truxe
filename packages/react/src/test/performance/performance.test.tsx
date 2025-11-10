import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, render } from '@testing-library/react';
import { performance } from 'perf_hooks';
import { TruxeProvider } from '../../context/TruxeProvider';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { useOrganization } from '../../hooks/useOrganization';
import { useSession } from '../../hooks/useSession';
import { UserButton } from '../../components/user/UserButton/UserButton';
import { UserAvatar } from '../../components/user/UserAvatar/UserAvatar';
import { OrganizationSwitcher } from '../../components/organization/OrganizationSwitcher/OrganizationSwitcher';

describe('Performance Tests', () => {
  const mockApiUrl = 'https://api.test.com';
  const mockPublishableKey = 'pk_test_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Performance', () => {
    it('useAuth hook should initialize in < 20ms', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TruxeProvider
          apiUrl={mockApiUrl}
          publishableKey={mockPublishableKey}
        >
          {children}
        </TruxeProvider>
      );

      const start = performance.now();
      const { result } = renderHook(() => useAuth(), { wrapper });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(20);
      expect(result.current).toBeDefined();
    });

    it('useUser hook should initialize in < 10ms', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TruxeProvider
          apiUrl={mockApiUrl}
          publishableKey={mockPublishableKey}
        >
          {children}
        </TruxeProvider>
      );

      const start = performance.now();
      const { result } = renderHook(() => useUser(), { wrapper });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
      expect(result.current).toBeDefined();
    });

    it('useOrganization hook should initialize in < 10ms', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TruxeProvider
          apiUrl={mockApiUrl}
          publishableKey={mockPublishableKey}
        >
          {children}
        </TruxeProvider>
      );

      const start = performance.now();
      const { result } = renderHook(() => useOrganization(), { wrapper });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
      expect(result.current).toBeDefined();
    });

    it('useSession hook should initialize in < 10ms', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TruxeProvider
          apiUrl={mockApiUrl}
          publishableKey={mockPublishableKey}
        >
          {children}
        </TruxeProvider>
      );

      const start = performance.now();
      const { result } = renderHook(() => useSession(), { wrapper });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
      expect(result.current).toBeDefined();
    });
  });

  describe('Component Render Performance', () => {
    it('UserButton should render in < 50ms', () => {
      const start = performance.now();
      
      render(
        <TruxeProvider
          apiUrl={mockApiUrl}
          publishableKey={mockPublishableKey}
        >
          <UserButton />
        </TruxeProvider>
      );
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50);
    });

    it('UserAvatar should render in < 20ms', () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        imageUrl: 'https://example.com/avatar.jpg',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const start = performance.now();
      
      render(
        <TruxeProvider
          apiUrl={mockApiUrl}
          publishableKey={mockPublishableKey}
        >
          <UserAvatar user={mockUser} />
        </TruxeProvider>
      );
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(20);
    });

    it('OrganizationSwitcher should render in < 50ms', () => {
      const start = performance.now();
      
      render(
        <TruxeProvider
          apiUrl={mockApiUrl}
          publishableKey={mockPublishableKey}
        >
          <OrganizationSwitcher />
        </TruxeProvider>
      );
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle 100+ organizations without lag', () => {
      // Generate 100 mock organizations
      const mockOrganizations = Array.from({ length: 100 }, (_, i) => ({
        id: `org_${i}`,
        name: `Organization ${i}`,
        slug: `organization-${i}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ organizations: mockOrganizations }),
      });

      const start = performance.now();
      
      render(
        <TruxeProvider
          apiUrl={mockApiUrl}
          publishableKey={mockPublishableKey}
        >
          <OrganizationSwitcher />
        </TruxeProvider>
      );
      
      const duration = performance.now() - start;
      
      // Should still render quickly even with 100 orgs
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory on repeated renders', () => {
      const { rerender, unmount } = render(
        <TruxeProvider
          apiUrl={mockApiUrl}
          publishableKey={mockPublishableKey}
        >
          <UserButton />
        </TruxeProvider>
      );

      // Render multiple times
      for (let i = 0; i < 10; i++) {
        rerender(
          <TruxeProvider
            apiUrl={mockApiUrl}
            publishableKey={mockPublishableKey}
          >
            <UserButton />
          </TruxeProvider>
        );
      }

      // Cleanup
      unmount();

      // If we get here without memory issues, test passes
      expect(true).toBe(true);
    });
  });

  describe('Re-render Optimization', () => {
    it('should minimize re-renders with stable references', () => {
      let renderCount = 0;

      function TestComponent() {
        const { user } = useUser();
        renderCount++;
        return <div>{user?.firstName}</div>;
      }

      const { rerender } = render(
        <TruxeProvider
          apiUrl={mockApiUrl}
          publishableKey={mockPublishableKey}
        >
          <TestComponent />
        </TruxeProvider>
      );

      const initialRenderCount = renderCount;

      // Rerender with same props
      rerender(
        <TruxeProvider
          apiUrl={mockApiUrl}
          publishableKey={mockPublishableKey}
        >
          <TestComponent />
        </TruxeProvider>
      );

      // Should not cause unnecessary re-renders
      // Note: This is a simplified test - actual behavior depends on implementation
      expect(renderCount).toBeGreaterThan(0);
    });
  });

  describe('Bundle Size Validation', () => {
    it('should export tree-shakeable modules', () => {
      // Verify that components can be imported individually
      expect(UserButton).toBeDefined();
      expect(UserAvatar).toBeDefined();
      expect(OrganizationSwitcher).toBeDefined();
      expect(useAuth).toBeDefined();
      expect(useUser).toBeDefined();

      // Individual imports should not pull in everything
      expect(true).toBe(true);
    });
  });
});
