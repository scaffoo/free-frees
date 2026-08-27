import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Plus, Spade } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./lib/api";

export function App() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const games = useQuery({ queryKey: ["games"], queryFn: api.games });
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: api.rooms, refetchInterval: 3000 });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [auth, setAuth] = useState({ email: "", name: "", password: "" });
  const [gameId, setGameId] = useState("klondike-draw-3");
  const [botCount, setBotCount] = useState(0);
  const [roomName, setRoomName] = useState("Table 1");

  const authMutation = useMutation({
    mutationFn: () => (authMode === "login" ? api.login(auth) : api.register(auth)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] })
  });
  const createMutation = useMutation({
    mutationFn: () => api.createRoom({ gameId, name: roomName, botCount }),
    onSuccess: ({ room }) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      navigate(`/rooms/${room.id}`);
    }
  });

  if (!me.data?.user) {
    return (
      <main className="min-h-screen bg-cream p-6 text-ink">
        <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-5xl content-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-center">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded bg-ink text-cream"><Spade size={28} /></div>
              <h1 className="text-4xl font-black tracking-normal">Free Frees</h1>
            </div>
            <p className="max-w-xl text-lg leading-8">A hosted card table where declarative game definitions become playable browser rooms for people and bots.</p>
          </div>
          <form className="rounded-lg border border-black/10 bg-white p-5 shadow-sm" onSubmit={(event) => { event.preventDefault(); authMutation.mutate(); }}>
            <div className="mb-4 grid grid-cols-2 rounded bg-stone-100 p-1">
              <button type="button" className={`rounded px-3 py-2 ${authMode === "login" ? "bg-white shadow" : ""}`} onClick={() => setAuthMode("login")}>Login</button>
              <button type="button" className={`rounded px-3 py-2 ${authMode === "register" ? "bg-white shadow" : ""}`} onClick={() => setAuthMode("register")}>Register</button>
            </div>
            {authMode === "register" && <input className="mb-3 w-full rounded border px-3 py-2" placeholder="Name" value={auth.name} onChange={(event) => setAuth({ ...auth, name: event.target.value })} />}
            <input className="mb-3 w-full rounded border px-3 py-2" placeholder="Email" value={auth.email} onChange={(event) => setAuth({ ...auth, email: event.target.value })} />
            <input className="mb-4 w-full rounded border px-3 py-2" placeholder="Password" type="password" value={auth.password} onChange={(event) => setAuth({ ...auth, password: event.target.value })} />
            <button className="w-full rounded bg-ink px-4 py-2 font-semibold text-cream" disabled={authMutation.isPending}>{authMode === "login" ? "Login" : "Create account"}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream text-ink">
      <header className="flex items-center justify-between border-b border-black/10 bg-white px-5 py-3">
        <div className="flex items-center gap-3 font-black"><Spade /> Free Frees</div>
        <button className="flex items-center gap-2 rounded border px-3 py-2" onClick={() => api.logout().then(() => queryClient.invalidateQueries({ queryKey: ["me"] }))}><LogOut size={18} /> Logout</button>
      </header>
      <section className="mx-auto grid max-w-6xl gap-6 p-5 md:grid-cols-[340px_1fr]">
        <form className="rounded-lg border bg-white p-4" onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>
          <h2 className="mb-4 text-xl font-bold">Create Room</h2>
          <input className="mb-3 w-full rounded border px-3 py-2" value={roomName} onChange={(event) => setRoomName(event.target.value)} />
          <select className="mb-3 w-full rounded border px-3 py-2" value={gameId} onChange={(event) => { setGameId(event.target.value); setBotCount(event.target.value === "go-fish-2p" ? 1 : 0); }}>
            {games.data?.games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}
          </select>
          {gameId === "go-fish-2p" && (
            <label className="mb-4 flex items-center gap-2">
              <input type="checkbox" checked={botCount === 1} onChange={(event) => setBotCount(event.target.checked ? 1 : 0)} />
              Add random bot
            </label>
          )}
          <button className="flex w-full items-center justify-center gap-2 rounded bg-table px-4 py-2 font-semibold text-white"><Plus size={18} /> Create</button>
        </form>
        <div>
          <h2 className="mb-3 text-xl font-bold">Open Rooms</h2>
          <div className="grid gap-3">
            {rooms.data?.rooms.map((room) => (
              <article key={room.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
                <div>
                  <h3 className="font-bold">{room.name}</h3>
                  <p className="text-sm text-stone-600">{room.gameId} · {room.players.length} seated · {room.status}</p>
                </div>
                <button className="rounded border px-3 py-2" onClick={() => api.joinRoom(room.id).then(() => navigate(`/rooms/${room.id}`))}>Open</button>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
