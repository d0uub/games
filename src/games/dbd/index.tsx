import { useState } from "react";
import Lobby from "./Lobby";
import Match from "./Match";

type Stage = "lobby" | "match";

interface RosterPlayer { id: string; role: "survivor" | "killer"; name: string; }

export default function Dbd({ name, onExit }: { name: string; onExit: () => void }) {
  const [stage, setStage] = useState<Stage>("lobby");
  const [roster, setRoster] = useState<RosterPlayer[]>([]);

  const startMatch = (players: RosterPlayer[]) => {
    setRoster(players);
    setStage("match");
  };

  const backToLobby = () => {
    setStage("lobby");
    setRoster([]);
  };

  if (stage === "match" && roster.length) {
    return <Match roster={roster} onExit={backToLobby} />;
  }
  return <Lobby name={name} onStart={startMatch} onExit={onExit} />;
}
