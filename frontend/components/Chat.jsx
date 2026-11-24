import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { readChatEvents } from '../chatStream.js';
import ToolCall from './ToolCall.jsx';
import MarkdownAnswer from './MarkdownAnswer.jsx';

function getThreadId() {
  try {
    const saved = sessionStorage.getItem('puffskein-thread-id');
    if (saved && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(saved)) return saved;
    const id = crypto.randomUUID();
    sessionStorage.setItem('puffskein-thread-id', id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function finishTurn(turn, error = null) {
  return {
    ...turn, status: null, error,
    entries: turn.entries.map((entry) => entry.type === 'tool' && entry.running
      ? { ...entry, running: false, error: '工具调用已中断' } : entry),
  };
}

function applyEvent(turn, event) {
  switch (event.type) {
    case 'status':
      return { ...turn, status: event.status };
    case 'text': {
      const entries = [...turn.entries];
      const last = entries.at(-1);
      if (last?.type === 'text') entries[entries.length - 1] = { ...last, text: last.text + event.text };
      else entries.push({ type: 'text', text: event.text });
      return { ...turn, entries, status: 'answering' };
    }
    case 'tool_start':
      return {
        ...turn, status: event.name === 'tavily_search' ? 'searching' : 'calling_tool',
        entries: [...turn.entries, {
          type: 'tool', id: event.id, name: event.name, query: event.query,
          sources: [], running: true, error: null,
        }],
      };
    case 'tool_end': {
      const entries = turn.entries.map((entry) => entry.type === 'tool' && entry.id === event.id
        ? { ...entry, running: false, sources: event.sources || [], error: event.error, details: event.details } : entry);
      const running = entries.filter((entry) => entry.running);
      const status = running.some((entry) => entry.name === 'tavily_search') ? 'searching'
        : running.length > 0 ? 'calling_tool' : 'thinking';
      return { ...turn, entries, status };
    }
    case 'done':
      return finishTurn(turn);
    case 'error':
      return finishTurn(turn, event.message);
    default:
      return turn;
  }
}

const statusText = {
  thinking: '正在思考……', searching: '正在搜索……', answering: '正在回答……', calling_tool: '正在调用工具……',
};

export default function Chat() {
  const [message, setMessage] = useState('');
  const [turns, setTurns] = useState([]);
  const [allowSearch, setAllowSearch] = useState(true);
  const [threadId] = useState(getThreadId);
  const [isSending, setIsSending] = useState(false);
  const activeRequest = useRef(null);
  const responseArea = useRef(null);
  const followLatest = useRef(true);

  useEffect(() => () => activeRequest.current?.abort(), []);
  useLayoutEffect(() => {
    const area = responseArea.current;
    if (area && followLatest.current) area.scrollTop = area.scrollHeight;
  }, [turns]);

  async function handleSubmit(event) {
    event.preventDefault();
    const text = message.trim();
    if (!text || activeRequest.current) return;

    const controller = new AbortController();
    activeRequest.current = controller;
    const turnId = crypto.randomUUID();
    const updateTurn = (update) => setTurns((previous) => previous.map((turn) => (
      turn.id === turnId ? update(turn) : turn
    )));
    setIsSending(true);
    followLatest.current = true;
    setTurns((previous) => [...previous, {
      id: turnId, question: text, entries: [], status: 'thinking', error: null,
    }]);

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text, thread_id: threadId, allow_search: allowSearch,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`请求失败，状态码：${response.status}`);
      }
      await readChatEvents(response.body, (event) => updateTurn((turn) => applyEvent(turn, event)));
    } catch (error) {
      if (!controller.signal.aborted) {
        updateTurn((turn) => finishTurn(turn, `发送失败：${error.message}`));
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        if (!controller.signal.aborted) setIsSending(false);
      }
    }
  }

  return (
    <section id="chat" aria-label="AI 对话">
      <div
        id="ai-response"
        ref={responseArea}
        tabIndex={0}
        aria-label="对话记录"
        aria-live="polite"
        aria-busy={isSending}
        onScroll={(event) => {
          const area = event.currentTarget;
          followLatest.current = area.scrollHeight - area.scrollTop - area.clientHeight < 48;
        }}
      >
        {turns.length === 0 && '有什么需要我帮忙的吗？'}
        {turns.map((turn) => (
          <article key={turn.id} className="chat-turn">
            <p className="chat-question">{turn.question}</p>
            {turn.entries.map((entry, index) => entry.type === 'tool'
              ? <ToolCall key={entry.id} entry={entry} />
              : <MarkdownAnswer key={index} text={entry.text} />)}
            {turn.status && <p className="agent-status" role="status">{statusText[turn.status]}</p>}
            {turn.error && <p className="chat-error" role="alert">{turn.error}</p>}
          </article>
        ))}
      </div>
      <form id="chat-form" onSubmit={handleSubmit}>
        <label className="search-option">
          <input
            type="checkbox"
            checked={allowSearch}
            disabled={isSending}
            onChange={(event) => setAllowSearch(event.target.checked)}
          />
          联网搜索
        </label>
        <div className="chat-composer">
          <textarea
            id="user-input"
            aria-label="消息"
            placeholder="请输入消息"
            required
            aria-describedby="send-hint"
            aria-keyshortcuts="Shift+Enter"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (!event.repeat) event.currentTarget.form.requestSubmit();
              }
            }}
          />
          <button id="send-button" type="submit" disabled={isSending}>
            {isSending ? '发送中……' : '发送'}
          </button>
        </div>
      </form>
      <p id="send-hint">Shift + Enter 发送消息，Enter 换行</p>
    </section>
  );
}
