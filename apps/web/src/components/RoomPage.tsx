import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import type { RoomView } from "@free-frees/shared";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import { Table } from "./Table";

export function RoomPage() {
  const { roomId = "" } = useParams();
  const queryClient = useQueryClient();
  const room = useQuery({ queryKey: ["room", roomId], queryFn: () => api.getRoom(roomId), enabled: Boolean(roomId) });
  const games = useQuery({ queryKey: ["games"], queryFn: api.games });
  const move = useMutation({
    mutationFn: (moveId: string) => api.submitMove(roomId, moveId),
    onSuccess: ({ room }) => queryClient.setQueryData(["room", roomId], { room })
  });

  useEffect(() => {
    if (!roomId) return;
    socket.connect();
    socket.emit("room:join", roomId);
    const onUpdate = (updated: RoomView) => queryClient.setQueryData(["room", roomId], { room: updated });
    socket.on("room:update", onUpdate);
    return () => {
      socket.emit("room:leave", roomId);
      socket.off("room:update", onUpdate);
    };
  }, [queryClient, roomId]);

  const current = room.data?.room;
  const definition = games.data?.games.find((game) => game.id === current?.gameId);
  return (
    <main className="min-h-screen bg-cream text-ink">
      <header className="flex h-[72px] items-center justify-between border-b border-black/10 bg-white px-5">
        <div>
          <Link className="mb-1 flex items-center gap-1 text-sm text-stone-600" to="/"><ArrowLeft size={16} /> Lobby</Link>
          <h1 className="text-xl font-black">{current?.name ?? "Room"}</h1>
        </div>
        <div className="text-sm text-stone-600">{current?.status}</div>
      </header>
      {!current && <div className="p-5">Loading room...</div>}
      {current && definition && <Table definition={definition} room={current} onMove={(moveId) => move.mutate(moveId)} />}
    </main>
  );
}
