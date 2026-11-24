import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(async () => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<App />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function submit(message) {
  await act(async () => {
    const textarea = container.querySelector('textarea');
    // Invoke the native setter so React receives a real input change.
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
      .set.call(textarea, message);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    container.querySelector('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
}

describe('React workbench', () => {
  it('shows the greeting and a ticking clock', async () => {
    expect(container.textContent).toContain('有什么需要我帮忙的吗？');
    vi.useFakeTimers();
    const next = new Date('2026-01-02T03:04:05');
    vi.setSystemTime(next);
    // Remount to create the interval using fake timers.
    await act(async () => {
      root.render(<App key="clock-test" />);
    });
    expect(container.querySelector('#time').textContent).toBe('03:04:05');
    await act(async () => vi.advanceTimersByTime(1000));
    expect(container.querySelector('#time').textContent).toBe('03:04:06');
  });

  it('streams split UTF-8 chunks and prevents duplicate submissions', async () => {
    let stream;
    const fetch = vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) { stream = controller; },
    })));
    vi.stubGlobal('fetch', fetch);
    await submit('  你好  ');
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ message: '你好' });
    expect(container.querySelector('button').disabled).toBe(true);
    await submit('重复');
    expect(fetch).toHaveBeenCalledOnce();

    const bytes = new TextEncoder().encode('你好 React');
    await act(async () => {
      stream.enqueue(bytes.slice(0, 4));
    });
    expect(container.querySelector('#ai-response').textContent).toBe('你');
    await act(async () => {
      stream.enqueue(bytes.slice(4));
      stream.close();
    });
    expect(container.querySelector('#ai-response').textContent).toBe('你好 React');
    expect(container.querySelector('button').disabled).toBe(false);
  });

  it('ignores whitespace-only input', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await submit('   ');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows an HTTP error and allows retrying', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await submit('hello');
    expect(container.querySelector('#ai-response').textContent).toContain('状态码：500');
    expect(container.querySelector('button').disabled).toBe(false);
  });

  it('keeps a partial answer if the stream fails', async () => {
    let stream;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) { stream = controller; },
    }))));
    await submit('hello');
    await act(async () => stream.enqueue(new TextEncoder().encode('部分回答')));
    await act(async () => stream.error(new Error('连接中断')));
    expect(container.querySelector('#ai-response').textContent).toBe('部分回答\n发送失败：连接中断');
    expect(container.querySelector('button').disabled).toBe(false);
  });

  it('aborts an active request on unmount', async () => {
    const fetch = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetch);
    await submit('hello');
    const { signal } = fetch.mock.calls[0][1];
    await act(async () => root.render(null));
    expect(signal.aborted).toBe(true);
  });
});
