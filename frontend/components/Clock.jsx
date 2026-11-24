import { useEffect, useState } from 'react';

export default function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div id="clock">
      <span id="date">{now.toLocaleDateString('zh-CN')}</span>
      <span id="time">{now.toLocaleTimeString('zh-CN', { hour12: false })}</span>
    </div>
  );
}
