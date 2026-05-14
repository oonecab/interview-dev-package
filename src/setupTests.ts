import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Ant Design uses window.matchMedia for responsive breakpoints.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom's getComputedStyle throws "Not implemented" for dynamically created
// elements (e.g. those used by rc-util's scrollbar measurement). Replace it
// entirely so tests run cleanly.
window.getComputedStyle = () => {
  // Return a minimal CSSStyleDeclaration stub with no styles.
  // rc-util's measureScrollbarSize relies on overflow style; with no
  // overflow set, it skips the scrollbar measurement path.
  return {
    overflow: 'visible',
    overflowY: 'visible',
    getPropertyValue: () => '',
    getPropertyPriority: () => '',
    removeProperty: () => '',
    setProperty: () => undefined,
    item: () => '',
    length: 0,
    cssText: '',
    [Symbol.iterator]: function* () {},
  } as unknown as CSSStyleDeclaration;
};

// jsdom does not implement Element.scrollIntoView.
Element.prototype.scrollIntoView = vi.fn();
