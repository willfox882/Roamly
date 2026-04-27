import { createElement as h, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DeleteAccountSection, type DeleteAccountOpts } from '@/app/settings/page';

// Drive the DeleteAccountSection without rendering the full settings page
// (which depends on dexie-react-hooks + Dexie). The exported subcomponent
// is the unit under test.

function mount(el: React.ReactElement): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(el); });
  return { container, root };
}

function unmount(root: Root, container: HTMLElement): void {
  act(() => { root.unmount(); });
  container.remove();
}

function findButton(container: HTMLElement, label: RegExp): HTMLButtonElement {
  for (const b of Array.from(container.querySelectorAll('button'))) {
    if (label.test(b.textContent ?? '')) return b as HTMLButtonElement;
  }
  throw new Error(`Button matching ${label} not found`);
}

function click(btn: HTMLElement): void {
  act(() => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

async function flush(): Promise<void> {
  // Resolve pending promises and let React commit the post-resolve state.
  await act(async () => { await Promise.resolve(); });
}

describe('DeleteAccountSection', () => {
  it('shows the trigger button initially, no confirmation visible', () => {
    const onDelete = jest.fn(async () => {});
    const { container, root } = mount(h(DeleteAccountSection, { onDelete }));
    expect(findButton(container, /Delete Account & Cloud Data/i)).toBeTruthy();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    unmount(root, container);
  });

  it('opens the confirmation dialog with the "also delete local backups" checkbox unchecked by default', () => {
    const onDelete = jest.fn(async () => {});
    const { container, root } = mount(h(DeleteAccountSection, { onDelete }));
    click(findButton(container, /Delete Account & Cloud Data/i));
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const cb = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(cb).not.toBeNull();
    expect(cb.checked).toBe(false); // local backups preserved by default
    unmount(root, container);
  });

  it('Cancel returns to the trigger state without invoking onDelete', () => {
    const onDelete = jest.fn(async () => {});
    const { container, root } = mount(h(DeleteAccountSection, { onDelete }));
    click(findButton(container, /Delete Account & Cloud Data/i));
    click(findButton(container, /Cancel/i));
    expect(onDelete).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    unmount(root, container);
  });

  it('Confirm calls onDelete with alsoDeleteLocalBackups: false by default', async () => {
    const calls: DeleteAccountOpts[] = [];
    const onDelete = jest.fn(async (opts: DeleteAccountOpts) => { calls.push(opts); });
    const { container, root } = mount(h(DeleteAccountSection, { onDelete }));
    click(findButton(container, /Delete Account & Cloud Data/i));
    click(findButton(container, /Confirm permanent deletion/i));
    await flush();
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(calls[0]).toEqual({ alsoDeleteLocalBackups: false });
    unmount(root, container);
  });

  it('Confirm with backup-checkbox checked passes alsoDeleteLocalBackups: true', async () => {
    const calls: DeleteAccountOpts[] = [];
    const onDelete = jest.fn(async (opts: DeleteAccountOpts) => { calls.push(opts); });
    const { container, root } = mount(h(DeleteAccountSection, { onDelete }));
    click(findButton(container, /Delete Account & Cloud Data/i));
    const cb = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    act(() => { cb.click(); }); // toggles to checked
    expect(cb.checked).toBe(true);
    click(findButton(container, /Confirm permanent deletion/i));
    await flush();
    expect(calls[0]).toEqual({ alsoDeleteLocalBackups: true });
    unmount(root, container);
  });

  it('surfaces an error message when onDelete rejects, leaves dialog open', async () => {
    const onDelete = jest.fn(async () => { throw new Error('Cloud delete failed: HTTP 500'); });
    const { container, root } = mount(h(DeleteAccountSection, { onDelete }));
    click(findButton(container, /Delete Account & Cloud Data/i));
    click(findButton(container, /Confirm permanent deletion/i));
    await flush();
    expect(container.textContent ?? '').toMatch(/HTTP 500/);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    unmount(root, container);
  });
});
