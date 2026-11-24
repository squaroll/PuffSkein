import Chat from './components/Chat.jsx';
import Clock from './components/Clock.jsx';
import Todos from './components/Todos.jsx';

export default function App() {
  return (
    <>
      <header className="app-header"><h1>PuffSkein</h1></header>
      <main>
        <Chat />
        <Todos />
        <aside id="sidebar" aria-label="侧边栏">
          <Clock />
        </aside>
      </main>
    </>
  );
}
