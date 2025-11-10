import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Monaco Editor globally - using function mock to avoid JSX in setup
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(),
}))

// Mock clipboard API - only if it doesn't exist
if (!navigator.clipboard) {
  const mockClipboard = {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve('')),
  }

  Object.defineProperty(navigator, 'clipboard', {
    value: mockClipboard,
    writable: true,
    configurable: true,
  })
}

// Mock URL.createObjectURL and revokeObjectURL for file downloads
global.URL.createObjectURL = vi.fn(() => 'mocked-blob-url')
global.URL.revokeObjectURL = vi.fn()

// Mock ResizeObserver (often needed for Monaco Editor)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock document.execCommand for clipboard fallback
document.execCommand = vi.fn(() => true)

// Setup console mocking for cleaner test output
const originalError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})