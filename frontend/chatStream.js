// NDJSON records may span network chunks, including the bytes of a Chinese character.
export async function readChatEvents(body, onEvent) {
  if (!body) throw new Error('浏览器未提供响应流');
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = '';
  function consume(line) {
    if (!line.trim()) return false;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      throw new Error('无法解析服务器响应');
    }
    onEvent(event);
    return event.type === 'done' || event.type === 'error';
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += value;
      let newline;
      while ((newline = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        if (consume(line)) return;
      }
    }
    if (pending && consume(pending)) return;
    throw new Error('连接中断，回答可能不完整，请重试');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
