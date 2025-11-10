import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from './useAuth';

describe('useAuth', () => {
  it('should throw error when used outside TruxeProvider', () => {
    // Test that useAuth throws an error when not wrapped in provider
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within TruxeProvider');
  });
});