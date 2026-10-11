import { useState } from "react";
import GameMenu from "./components/GameMenu";
import Dbd from "./games/dbd";

export default function App() {
  const [game, setGame] = useState<string | null>(null);
  const [name, setName] = useState(() => `Player-${Math.floor(Math.random() * 900 + 100)}`);

  if (game === "dbd") {
    return <Dbd name={name} onExit={() => setGame(null)} />;
  }
  return (
    <GameMenu
      name={name}
      setName={setName}
      onPick={(id) => setGame(id)}
    />
  );
}
