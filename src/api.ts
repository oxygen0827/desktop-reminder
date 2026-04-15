import type { List, Todo, CreateTodoInput, UpdateTodoInput } from './types';

const API_BASE = 'http://localhost:3001/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`);
  }
  return res.json();
}

// 列表 API
export const api = {
  // Lists
  getLists: () => fetchJSON<List[]>('/lists'),

  createList: (name: string, color: string) =>
    fetchJSON<List>('/lists', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),

  updateList: (id: string, data: { name?: string; color?: string }) =>
    fetchJSON<List>(`/lists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteList: (id: string) =>
    fetchJSON<{ success: boolean }>(`/lists/${id}`, { method: 'DELETE' }),

  // Todos
  getTodos: (listId: string, completed?: boolean) => {
    const url = `/lists/${listId}/todos${completed !== undefined ? `?completed=${completed}` : ''}`;
    return fetchJSON<Todo[]>(url);
  },

  getAllTodos: (search?: string) => {
    const url = search ? `/todos?search=${encodeURIComponent(search)}` : '/todos';
    return fetchJSON<Todo[]>(url);
  },

  createTodo: (data: CreateTodoInput) =>
    fetchJSON<Todo>('/todos', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTodo: (id: string, data: UpdateTodoInput) =>
    fetchJSON<Todo>(`/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTodo: (id: string) =>
    fetchJSON<{ success: boolean }>(`/todos/${id}`, { method: 'DELETE' }),

  toggleTodo: (id: string) =>
    fetchJSON<Todo>(`/todos/${id}/toggle`, { method: 'POST' }),
};
