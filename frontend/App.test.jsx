import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(async () => {
  sessionStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<App />));
});

function eventBytes(...events) {
  return new TextEncoder().encode(events.map((event) => JSON.stringify(event) + '\n').join(''));
}

function answerResponse(text) {
  return new Response(eventBytes({ type: 'text', text }, { type: 'done' }));
}

function answerText() {
  return [...container.querySelectorAll('.answer-text')].map((element) => element.textContent).join('');
}

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function submit(message, keyboard = null) {
  await act(async () => {
    const textarea = container.querySelector('textarea');
    // Invoke the native setter so React receives a real input change.
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
      .set.call(textarea, message);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    if (keyboard) {
      const textarea = container.querySelector('textarea');
      textarea.focus();
      textarea.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', bubbles: true, cancelable: true, ...keyboard,
      }));
    } else {
      container.querySelector('#chat-form').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    }
  });
}

describe('React workbench', () => {
  it('sends with Shift+Enter while preserving ordinary Enter and IME composition', async () => {
    const fetch = vi.fn().mockImplementation(async () => answerResponse('收到'));
    vi.stubGlobal('fetch', fetch);
    await submit('hello', { shiftKey: false });
    await submit('hello', { shiftKey: true, isComposing: true });
    await submit('hello', { shiftKey: true, repeat: true });
    expect(fetch).not.toHaveBeenCalled();
    await submit('hello', { shiftKey: true });
    expect(fetch).toHaveBeenCalledOnce();
    expect(answerText()).toBe('收到');
  });

  it('adds, completes and deletes a todo card without submitting a chat', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const todos = container.querySelector('#todos');
    await act(async () => {
      const input = todos.querySelector('input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
        .set.call(input, '  阅读文档  ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => todos.querySelector('form').requestSubmit());
    expect(todos.querySelectorAll('.todo-card')).toHaveLength(1);
    expect(todos.textContent).toContain('阅读文档');
    expect(todos.textContent).toContain('1 项待完成');
    expect(todos.querySelector('input:not([type="checkbox"])').value).toBe('');
    await act(async () => todos.querySelector('input[type="checkbox"]').click());
    expect(todos.querySelector('.todo-card').classList.contains('is-done')).toBe(true);
    expect(todos.textContent).toContain('0 项待完成');
    await act(async () => todos.querySelector('.todo-card button').click());
    expect(todos.querySelectorAll('.todo-card')).toHaveLength(0);
    expect(todos.textContent).toContain('暂无待办事项');
    expect(fetch).not.toHaveBeenCalled();
  });

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
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ message: '你好', allow_search: true });
    expect(container.querySelector('button').disabled).toBe(true);
    await submit('重复');
    expect(fetch).toHaveBeenCalledOnce();

    const bytes = eventBytes({ type: 'text', text: '你' });
    const split = bytes.indexOf(0xe4) + 1;
    await act(async () => {
      stream.enqueue(bytes.slice(0, split));
    });
    expect(answerText()).toBe('');
    await act(async () => {
      stream.enqueue(bytes.slice(split));
    });
    expect(answerText()).toBe('你');
    await act(async () => {
      stream.enqueue(eventBytes({ type: 'text', text: '好 React' }, { type: 'done' }));
      stream.close();
    });
    expect(answerText()).toBe('你好 React');
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
    await act(async () => stream.enqueue(eventBytes({ type: 'text', text: '部分回答' })));
    await act(async () => stream.error(new Error('连接中断')));
    expect(answerText()).toBe('部分回答');
    expect(container.querySelector('.chat-error').textContent).toBe('发送失败：连接中断');
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

  it('keeps tool calls in order with source URLs and thinking/searching statuses', async () => {
    let stream;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) { stream = controller; },
    }))));
    await submit('搜索资料');
    expect(container.querySelector('[role="status"]').textContent).toBe('正在思考……');
    await act(async () => stream.enqueue(eventBytes(
      { type: 'text', text: '先查资料。' },
      { type: 'tool_start', id: 'one', name: 'tavily_search', query: 'React 文档' },
    )));
    expect(container.querySelector('[role="status"]').textContent).toBe('正在搜索……');
    await act(async () => stream.enqueue(eventBytes(
      { type: 'tool_end', id: 'one', sources: [{ title: 'React', url: 'https://react.dev/' }] },
      { type: 'status', status: 'thinking' },
    )));
    expect(container.querySelector('[role="status"]').textContent).toBe('正在思考……');
    expect(container.querySelector('.tool-details a').href).toBe('https://react.dev/');
    await act(async () => stream.enqueue(eventBytes(
      { type: 'tool_start', id: 'two', name: 'tavily_search', query: 'LangGraph 文档' },
      { type: 'tool_end', id: 'two', sources: [], error: '联网搜索失败' },
      { type: 'text', text: '最终回答。' },
      { type: 'done' },
    )));
    const entries = [...container.querySelector('.chat-turn').children];
    expect(entries.map((element) => element.className)).toEqual([
      'chat-question', 'answer-text', 'tool-call', 'tool-call', 'answer-text',
    ]);
    expect(entries[1].textContent).toBe('先查资料。');
    expect(entries[2].textContent).toContain('React 文档');
    expect(entries[3].textContent).toContain('联网搜索失败');
    expect(entries[4].textContent).toBe('最终回答。');
    expect(container.querySelector('[role="status"]')).toBeNull();
    const trigger = container.querySelector('.tool-trigger');
    expect(document.getElementById(trigger.getAttribute('aria-describedby')).getAttribute('role')).toBe('tooltip');
  });

  it('passes search permission and reuses its thread across turns and remounts', async () => {
    const fetch = vi.fn().mockImplementation(async () => answerResponse('回答'));
    vi.stubGlobal('fetch', fetch);
    const search = container.querySelector('.search-option input');
    expect(search.checked).toBe(true);
    await act(async () => search.click());
    await submit('第一条');
    await submit('第二条');
    expect(container.querySelectorAll('.chat-turn')).toHaveLength(2);
    const first = JSON.parse(fetch.mock.calls[0][1].body);
    const second = JSON.parse(fetch.mock.calls[1][1].body);
    expect(first.allow_search).toBe(false);
    expect(first.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(second.thread_id).toBe(first.thread_id);
    expect(first.thread_id).toMatch(/^[\da-f-]{36}$/);
    await act(async () => root.render(<App key="reload" />));
    await submit('刷新后继续');
    expect(JSON.parse(fetch.mock.calls[2][1].body).thread_id).toBe(first.thread_id);
  });

  it('reports an interrupted event stream while retaining text and tool history', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(eventBytes(
      { type: 'tool_start', id: 'one', name: 'tavily_search', query: '资料' },
      { type: 'tool_end', id: 'one', sources: [] },
      { type: 'text', text: '部分回答' },
    ))));
    await submit('hello');
    expect(answerText()).toBe('部分回答');
    expect(container.querySelectorAll('.tool-call')).toHaveLength(1);
    expect(container.querySelector('.chat-error').textContent).toContain('回答可能不完整');
    expect(container.querySelector('#send-button').disabled).toBe(false);
  });

  it('shows a terminal server error without losing the pending tool record', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(eventBytes(
      { type: 'tool_start', id: 'one', name: 'tavily_search', query: '资料' },
      { type: 'error', message: '模型不可用' },
    ))));
    await submit('hello');
    expect(container.querySelector('.tool-trigger').textContent).toContain('失败');
    expect(container.querySelector('[role="alert"]').textContent).toBe('模型不可用');
    expect(container.querySelector('#send-button').disabled).toBe(false);
  });

  it('renders Markdown formatting, code, tables, and inline and display LaTeX', async () => {
    const markdown = '# 标题\n\n**加粗**与[链接](https://example.com)\n\n'
      + '- 第一项\n- 第二项\n\n```js\nconst x = 1;\n```\n\n'
      + '| 名称 | 数值 |\n| --- | --- |\n| x | 1 |\n\n'
      + '行内 $x^2$\n\n$$\n\\frac{1}{2}\n$$';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answerResponse(markdown)));
    await submit('排版示例');
    const answer = container.querySelector('.answer-text');
    expect(answer.querySelector('h1').textContent).toBe('标题');
    expect(answer.querySelector('strong').textContent).toBe('加粗');
    expect(answer.querySelector('a').href).toBe('https://example.com/');
    expect(answer.querySelectorAll('li')).toHaveLength(2);
    expect(answer.querySelector('pre code').textContent).toContain('const x = 1;');
    expect(answer.querySelector('table td').textContent).toBe('x');
    expect(answer.querySelectorAll('.katex')).toHaveLength(2);
    expect(answer.querySelector('.katex-display math')).not.toBeNull();
  });

  it('does not execute HTML or unsafe links in model output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answerResponse(
      '<script>alert(1)</script>\n\n[危险链接](javascript:alert%281%29)\n\n<img src=x onerror=alert(1)>',
    )));
    await submit('hello');
    const answer = container.querySelector('.answer-text');
    expect(answer.querySelector('script')).toBeNull();
    expect(answer.querySelector('[onerror]')).toBeNull();
    expect(answer.querySelector('a').getAttribute('href')).not.toMatch(/^javascript:/);
  });

  it('shows a local time tool status and result without search-specific labels', async () => {
    let stream;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) { stream = controller; },
    }))));
    await submit('现在几点？');
    await act(async () => stream.enqueue(eventBytes(
      { type: 'tool_start', id: 'time-one', name: 'get_current_time' },
    )));
    expect(container.querySelector('[role="status"]').textContent).toBe('正在调用工具……');
    expect(container.querySelector('.tool-details').textContent).not.toContain('搜索词');
    await act(async () => stream.enqueue(eventBytes(
      { type: 'tool_end', id: 'time-one', sources: [], details: '当前时间：2026-11-24T15:30:00+08:00，时区：Asia/Shanghai' },
      { type: 'text', text: '下午三点半。' },
      { type: 'done' },
    )));
    expect(container.querySelector('.tool-details').textContent).toContain('Asia/Shanghai');
    expect(container.querySelector('.tool-details').textContent).not.toContain('未搜索到');
    expect(answerText()).toBe('下午三点半。');
  });
});
