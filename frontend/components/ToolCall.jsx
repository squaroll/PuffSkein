import { useLayoutEffect, useRef, useState } from 'react';

export default function ToolCall({ entry }) {
  const trigger = useRef(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const descriptionId = `tool-${entry.id}`;
  const isSearch = entry.name === 'tavily_search';
  const sources = entry.sources.filter((source) => /^https?:\/\//i.test(source.url));

  useLayoutEffect(() => {
    if (!active) return;
    function updatePosition() {
      const rect = trigger.current.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 32);
      const height = Math.min(320, window.innerHeight - 32);
      const fitsRight = rect.right + width <= window.innerWidth - 16;
      setPosition({
        left: fitsRight ? rect.right : Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)),
        top: Math.max(16, Math.min(fitsRight ? rect.top : rect.bottom, window.innerHeight - height - 16)),
      });
    }
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [active]);

  return (
    <div
      className="tool-call"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) setActive(false);
      }}
      onFocus={() => setActive(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setActive(false);
      }}
    >
      <button ref={trigger} type="button" className="tool-trigger" aria-describedby={descriptionId}>
        调用工具【{entry.name}】
        {entry.running ? '（进行中）' : entry.error ? '（失败）' : '（完成）'}
      </button>
      <div id={descriptionId} className="tool-details" role="tooltip" style={position}>
        {isSearch && <p>搜索词：{entry.query || '未提供'}</p>}
        {entry.running && <p>{isSearch ? '正在搜索……' : '正在调用工具……'}</p>}
        {entry.details && <p>{entry.details}</p>}
        {entry.error && <p className="chat-error">{entry.error}</p>}
        {sources.length > 0 ? (
          <ul>
            {sources.map((source, index) => (
              <li key={`${source.url}-${index}`}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title || source.url}
                  {source.title && <span className="source-url">{source.url}</span>}
                </a>
              </li>
            ))}
          </ul>
        ) : isSearch && !entry.running && !entry.error && <p>未搜索到相关网页。</p>}
      </div>
    </div>
  );
}
