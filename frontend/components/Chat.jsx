import { useEffect, useRef, useState } from 'react';

export default function Chat() {
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState('有什么需要我帮忙的吗？');
  const [isSending, setIsSending] = useState(false);
  const activeRequest = useRef(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function handleSubmit(event) {
    event.preventDefault();
    const text = message.trim();
    if (!text || activeRequest.current) return;

    const controller = new AbortController();
    activeRequest.current = controller;
    setIsSending(true);
    setAnswer('正在思考……');

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`请求失败，状态码：${response.status}`);
      }
      if (!response.body) throw new Error('浏览器未提供响应流');

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      setAnswer('');
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          setAnswer((previous) => previous + value);
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setAnswer((previous) => `${previous}\n发送失败：${error.message}`);
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
      <div id="ai-response" aria-live="polite" aria-busy={isSending}>
        {answer}
      </div>
      <form id="chat-form" onSubmit={handleSubmit}>
        <textarea
          id="user-input"
          aria-label="消息"
          placeholder="请输入消息"
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button id="send-button" type="submit" disabled={isSending}>
          {isSending ? '发送中……' : '发送'}
        </button>
      </form>
    </section>
  );
}
