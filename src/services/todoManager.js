const fs = require('fs');
const path = require('path');

const TODOS_FILE = path.resolve(__dirname, '../../todos_local.json');
const memoryTodos = new Map(); // userId -> string[]

function loadTodosFromDisk() {
  try {
    if (fs.existsSync(TODOS_FILE)) {
      const data = fs.readFileSync(TODOS_FILE, 'utf8');
      const parsed = JSON.parse(data) || {};
      for (const [userId, items] of Object.entries(parsed)) {
        memoryTodos.set(userId, Array.isArray(items) ? items : []);
      }
    }
  } catch (err) {
    console.error('Error loading todos from disk:', err.message);
  }
}

function saveTodosToDisk() {
  try {
    const obj = {};
    for (const [userId, items] of memoryTodos.entries()) {
      if (items && items.length > 0) {
        obj[userId] = items;
      }
    }
    fs.writeFileSync(TODOS_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving todos to disk:', err.message);
  }
}

// Initial load
loadTodosFromDisk();

function getTodos(userId) {
  return memoryTodos.get(userId) || [];
}

function addTodo(userId, item) {
  if (!memoryTodos.has(userId)) {
    memoryTodos.set(userId, []);
  }
  const list = memoryTodos.get(userId);
  list.push(item);
  saveTodosToDisk();
  return list;
}

function removeTodo(userId, target) {
  const list = memoryTodos.get(userId) || [];
  if (list.length === 0) return { removed: null, remaining: [] };

  const idx = parseInt(target, 10);
  let removed = null;

  if (!isNaN(idx) && idx >= 1 && idx <= list.length) {
    removed = list.splice(idx - 1, 1)[0];
  } else if (target) {
    const matchIdx = list.findIndex(t => t.toLowerCase().includes(String(target).toLowerCase()));
    if (matchIdx !== -1) {
      removed = list.splice(matchIdx, 1)[0];
    }
  }

  if (removed) {
    saveTodosToDisk();
  }
  return { removed, remaining: list };
}

function clearTodos(userId) {
  memoryTodos.delete(userId);
  saveTodosToDisk();
}

module.exports = {
  getTodos,
  addTodo,
  removeTodo,
  clearTodos,
};
