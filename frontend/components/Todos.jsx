import { useState } from 'react';

export default function Todos() {
  const [draft, setDraft] = useState('');
  const [todos, setTodos] = useState([]);
  const remaining = todos.filter((todo) => !todo.done).length;

  function addTodo(event) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setTodos((previous) => [...previous, { id: crypto.randomUUID(), title, done: false }]);
    setDraft('');
  }

  return (
    <section id="todos" aria-labelledby="todos-title">
      <div className="todos-heading">
        <h2 id="todos-title">待办事项</h2>
        <span aria-live="polite">{remaining} 项待完成</span>
      </div>
      <form onSubmit={addTodo}>
        <input
          aria-label="新的待办事项"
          placeholder="添加一件待办事项"
          required
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">添加</button>
      </form>
      {todos.length === 0 ? (
        <p className="todos-empty">暂无待办事项，添加一件开始吧。</p>
      ) : (
        <ul className="todo-cards">
          {todos.map((todo) => (
            <li key={todo.id} className={`todo-card${todo.done ? ' is-done' : ''}`}>
              <label>
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => setTodos((previous) => previous.map((item) => (
                    item.id === todo.id ? { ...item, done: !item.done } : item
                  )))}
                />
                <span>{todo.title}</span>
              </label>
              <button
                type="button"
                aria-label={`删除待办：${todo.title}`}
                onClick={() => setTodos((previous) => previous.filter((item) => item.id !== todo.id))}
              >删除</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
