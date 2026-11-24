import Chat from './components/Chat.jsx';
import Clock from './components/Clock.jsx';

export default function App() {
  return (
    <main>
      <h1>PuffSkein</h1>
      <Chat />
      <aside id="sidebar" aria-label="时钟">
        <Clock />
      </aside>
    </main>
  );
}
