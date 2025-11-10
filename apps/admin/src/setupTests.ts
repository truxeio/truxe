import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock getComputedStyle
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    getPropertyValue: () => '',
  }),
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
  },
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
  
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('componentWillReceiveProps') ||
       args[0].includes('componentWillMount'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mocked-url');
global.URL.revokeObjectURL = jest.fn();

// Mock scrollTo
global.scrollTo = jest.fn();

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = jest.fn(() => ({
  width: 120,
  height: 120,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  x: 0,
  y: 0,
  toJSON: jest.fn(),
}));

// Mock getClientRects
Element.prototype.getClientRects = jest.fn(() => ({
  length: 0,
  item: jest.fn(),
  [Symbol.iterator]: jest.fn(),
}));

// Mock focus and blur
HTMLElement.prototype.focus = jest.fn();
HTMLElement.prototype.blur = jest.fn();

// Mock click
HTMLElement.prototype.click = jest.fn();

// Mock addEventListener and removeEventListener
HTMLElement.prototype.addEventListener = jest.fn();
HTMLElement.prototype.removeEventListener = jest.fn();

// Mock dispatchEvent
HTMLElement.prototype.dispatchEvent = jest.fn();

// Mock querySelector and querySelectorAll
HTMLElement.prototype.querySelector = jest.fn();
HTMLElement.prototype.querySelectorAll = jest.fn();

// Mock closest
HTMLElement.prototype.closest = jest.fn();

// Mock matches
HTMLElement.prototype.matches = jest.fn();

// Mock contains
HTMLElement.prototype.contains = jest.fn();

// Mock insertAdjacentHTML
HTMLElement.prototype.insertAdjacentHTML = jest.fn();

// Mock insertAdjacentElement
HTMLElement.prototype.insertAdjacentElement = jest.fn();

// Mock insertAdjacentText
HTMLElement.prototype.insertAdjacentText = jest.fn();

// Mock scrollIntoView
HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock scrollTo
HTMLElement.prototype.scrollTo = jest.fn();

// Mock scrollBy
HTMLElement.prototype.scrollBy = jest.fn();

// Mock scroll
HTMLElement.prototype.scroll = jest.fn();

// Mock scrollLeft and scrollTop
Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
  writable: true,
  value: 0,
});

Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
  writable: true,
  value: 0,
});

// Mock offsetWidth and offsetHeight
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  writable: true,
  value: 120,
});

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  writable: true,
  value: 120,
});

// Mock clientWidth and clientHeight
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  writable: true,
  value: 120,
});

Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  writable: true,
  value: 120,
});

// Mock scrollWidth and scrollHeight
Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
  writable: true,
  value: 120,
});

Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
  writable: true,
  value: 120,
});

// Mock innerHTML and textContent
Object.defineProperty(HTMLElement.prototype, 'innerHTML', {
  writable: true,
  value: '',
});

Object.defineProperty(HTMLElement.prototype, 'textContent', {
  writable: true,
  value: '',
});

// Mock classList
Object.defineProperty(HTMLElement.prototype, 'classList', {
  writable: true,
  value: {
    add: jest.fn(),
    remove: jest.fn(),
    contains: jest.fn(),
    toggle: jest.fn(),
    replace: jest.fn(),
    item: jest.fn(),
    toString: jest.fn(() => ''),
    length: 0,
    [Symbol.iterator]: jest.fn(),
  },
});

// Mock dataset
Object.defineProperty(HTMLElement.prototype, 'dataset', {
  writable: true,
  value: {},
});

// Mock attributes
Object.defineProperty(HTMLElement.prototype, 'attributes', {
  writable: true,
  value: {
    getNamedItem: jest.fn(),
    setNamedItem: jest.fn(),
    removeNamedItem: jest.fn(),
    item: jest.fn(),
    length: 0,
    [Symbol.iterator]: jest.fn(),
  },
});

// Mock getAttribute and setAttribute
HTMLElement.prototype.getAttribute = jest.fn();
HTMLElement.prototype.setAttribute = jest.fn();
HTMLElement.prototype.removeAttribute = jest.fn();
HTMLElement.prototype.hasAttribute = jest.fn();

// Mock getBoundingClientRect
HTMLElement.prototype.getBoundingClientRect = jest.fn(() => ({
  width: 120,
  height: 120,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  x: 0,
  y: 0,
  toJSON: jest.fn(),
}));

// Mock getClientRects
HTMLElement.prototype.getClientRects = jest.fn(() => ({
  length: 0,
  item: jest.fn(),
  [Symbol.iterator]: jest.fn(),
}));

// Mock focus and blur
HTMLElement.prototype.focus = jest.fn();
HTMLElement.prototype.blur = jest.fn();

// Mock click
HTMLElement.prototype.click = jest.fn();

// Mock addEventListener and removeEventListener
HTMLElement.prototype.addEventListener = jest.fn();
HTMLElement.prototype.removeEventListener = jest.fn();

// Mock dispatchEvent
HTMLElement.prototype.dispatchEvent = jest.fn();

// Mock querySelector and querySelectorAll
HTMLElement.prototype.querySelector = jest.fn();
HTMLElement.prototype.querySelectorAll = jest.fn();

// Mock closest
HTMLElement.prototype.closest = jest.fn();

// Mock matches
HTMLElement.prototype.matches = jest.fn();

// Mock contains
HTMLElement.prototype.contains = jest.fn();

// Mock insertAdjacentHTML
HTMLElement.prototype.insertAdjacentHTML = jest.fn();

// Mock insertAdjacentElement
HTMLElement.prototype.insertAdjacentElement = jest.fn();

// Mock insertAdjacentText
HTMLElement.prototype.insertAdjacentText = jest.fn();

// Mock scrollIntoView
HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock scrollTo
HTMLElement.prototype.scrollTo = jest.fn();

// Mock scrollBy
HTMLElement.prototype.scrollBy = jest.fn();

// Mock scroll
HTMLElement.prototype.scroll = jest.fn();

// Mock scrollLeft and scrollTop
Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
  writable: true,
  value: 0,
});

Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
  writable: true,
  value: 0,
});

// Mock offsetWidth and offsetHeight
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  writable: true,
  value: 120,
});

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  writable: true,
  value: 120,
});

// Mock clientWidth and clientHeight
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  writable: true,
  value: 120,
});

Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  writable: true,
  value: 120,
});

// Mock scrollWidth and scrollHeight
Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
  writable: true,
  value: 120,
});

Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
  writable: true,
  value: 120,
});

// Mock innerHTML and textContent
Object.defineProperty(HTMLElement.prototype, 'innerHTML', {
  writable: true,
  value: '',
});

Object.defineProperty(HTMLElement.prototype, 'textContent', {
  writable: true,
  value: '',
});

// Mock classList
Object.defineProperty(HTMLElement.prototype, 'classList', {
  writable: true,
  value: {
    add: jest.fn(),
    remove: jest.fn(),
    contains: jest.fn(),
    toggle: jest.fn(),
    replace: jest.fn(),
    item: jest.fn(),
    toString: jest.fn(() => ''),
    length: 0,
    [Symbol.iterator]: jest.fn(),
  },
});

// Mock dataset
Object.defineProperty(HTMLElement.prototype, 'dataset', {
  writable: true,
  value: {},
});

// Mock attributes
Object.defineProperty(HTMLElement.prototype, 'attributes', {
  writable: true,
  value: {
    getNamedItem: jest.fn(),
    setNamedItem: jest.fn(),
    removeNamedItem: jest.fn(),
    item: jest.fn(),
    length: 0,
    [Symbol.iterator]: jest.fn(),
  },
});

// Mock getAttribute and setAttribute
HTMLElement.prototype.getAttribute = jest.fn();
HTMLElement.prototype.setAttribute = jest.fn();
HTMLElement.prototype.removeAttribute = jest.fn();
HTMLElement.prototype.hasAttribute = jest.fn();

