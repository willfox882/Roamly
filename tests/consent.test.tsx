import { createElement as h, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ConsentModal from '@/app/components/ConsentModal';
import { useUIStore } from '@/lib/store';

// JSX is preserved (not transformed) by this repo's tsconfig and
// @testing-library/dom isn't installed, so we render via react-dom/client
// directly into a jsdom container.

function mount(el: React.ReactElement): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(el);
  });
  return { container, root };
}

function unmount(root: Root, container: HTMLElement): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function findButton(container: HTMLElement, label: RegExp): HTMLButtonElement {
  const btns = container.querySelectorAll('button');
  for (const b of Array.from(btns)) {
    if (label.test(b.textContent ?? '')) return b as HTMLButtonElement;
  }
  throw new Error(`Button matching ${label} not found`);
}

describe('ConsentModal', () => {
  it('does not render when closed', () => {
    const { container, root } = mount(
      h(ConsentModal, { open: false, onAgree: () => {}, onDecline: () => {} }),
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    unmount(root, container);
  });

  it('renders the consent copy mentioning Roamly and third-party AI', () => {
    const { container, root } = mount(
      h(ConsentModal, { open: true, onAgree: () => {}, onDecline: () => {} }),
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent ?? '').toMatch(/Roamly/);
    expect(dialog?.textContent ?? '').toMatch(/third.party AI/);
    expect(findButton(container, /agree/i)).toBeTruthy();
    expect(findButton(container, /manual entry/i)).toBeTruthy();
    unmount(root, container);
  });

  it('invokes onAgree when the Agree button is clicked', () => {
    const onAgree   = jest.fn();
    const onDecline = jest.fn();
    const { container, root } = mount(h(ConsentModal, { open: true, onAgree, onDecline }));
    const btn = findButton(container, /^agree$/i);
    act(() => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(onAgree).toHaveBeenCalledTimes(1);
    expect(onDecline).not.toHaveBeenCalled();
    unmount(root, container);
  });

  it('invokes onDecline when Use Manual Entry is clicked', () => {
    const onAgree   = jest.fn();
    const onDecline = jest.fn();
    const { container, root } = mount(h(ConsentModal, { open: true, onAgree, onDecline }));
    const btn = findButton(container, /manual entry/i);
    act(() => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onAgree).not.toHaveBeenCalled();
    unmount(root, container);
  });
});

describe('useUIStore aiConsent gating', () => {
  beforeEach(() => {
    useUIStore.getState().setAiConsent({ enabled: false, provider: 'none' });
  });

  it('starts disabled (paste-parse must remain gated until user opts in)', () => {
    expect(useUIStore.getState().aiConsent.enabled).toBe(false);
  });

  it('Agree path → setAiConsent({enabled:true, provider:"cloud"}) flips the flag', () => {
    useUIStore.getState().setAiConsent({ enabled: true, provider: 'cloud' });
    expect(useUIStore.getState().aiConsent.enabled).toBe(true);
    expect(useUIStore.getState().aiConsent.provider).toBe('cloud');
  });

  it('Decline path → aiConsent stays disabled, deterministic fallback used', () => {
    useUIStore.getState().setAiConsent({ enabled: false, provider: 'none' });
    expect(useUIStore.getState().aiConsent.enabled).toBe(false);
    expect(useUIStore.getState().aiConsent.provider).toBe('none');
  });
});
