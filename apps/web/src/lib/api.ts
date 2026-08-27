import type { DeclarativeGameDefinition, PublicRoom, RoomView } from "@free-frees/shared";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  if (!response.ok) throw new Error((await response.text()) || response.statusText);
  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<{ user: { id: string; email: string; name: string } | null }>("/auth/me"),
  register: (input: { email: string; name: string; password: string }) => request<{ user: { id: string; email: string; name: string } }>("/auth/register", { method: "POST", body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) => request<{ user: { id: string; email: string; name: string } }>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  games: () => request<{ games: DeclarativeGameDefinition[] }>("/games"),
  rooms: () => request<{ rooms: PublicRoom[] }>("/rooms"),
  createRoom: (input: { gameId: string; name: string; botCount: number }) => request<{ room: RoomView }>("/rooms", { method: "POST", body: JSON.stringify(input) }),
  joinRoom: (roomId: string) => request<{ room: RoomView }>("/rooms/join", { method: "POST", body: JSON.stringify({ roomId }) }),
  getRoom: (roomId: string) => request<{ room: RoomView }>(`/rooms/${roomId}`),
  submitMove: (roomId: string, moveId: string) => request<{ room: RoomView }>(`/rooms/${roomId}/moves`, { method: "POST", body: JSON.stringify({ moveId }) })
};
