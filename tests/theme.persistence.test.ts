/**
 * @jest-environment jsdom
 */

describe('Theme Persistence Script', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  const runScript = () => {
    // Simulate the inline script logic
    try {
      const stored = localStorage.getItem('roamly:theme');
      const supportDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (stored === 'dark' || (!stored && supportDark)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  };

  it('should apply dark theme if stored as dark', () => {
    localStorage.setItem('roamly:theme', 'dark');
    runScript();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should apply light theme if stored as light', () => {
    localStorage.setItem('roamly:theme', 'light');
    runScript();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should fall back to prefers-color-scheme: dark if nothing stored', () => {
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      })),
    });

    runScript();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
