import { useRef, useCallback } from "react";

interface Props {
  label: string;
  sub?: string;
  onDown?: () => void;
  onUp?: () => void;
  onClick?: () => void;
  disabled?: boolean;
  color?: string;
  size?: number;
  className?: string;
}

// Big round touch button. Fires onDown on touchstart/mousedown and onUp on
// release; or a simple onClick for momentary actions.
export default function ActionButton({
  label, sub, onDown, onUp, onClick, disabled, color = "#3b82f6", size = 84, className,
}: Props) {
  const held = useRef(false);
  const start = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      if (onDown) { held.current = true; onDown(); }
    },
    [disabled, onDown]
  );
  const end = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      if (held.current && onUp) { held.current = false; onUp(); }
      else if (!onDown && onClick) onClick();
    },
    [disabled, onUp, onClick]
  );
  return (
    <button
      className={className}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: disabled ? "#334155" : color,
        color: "#fff", border: "3px solid rgba(255,255,255,0.6)",
        fontSize: size * 0.2, fontWeight: 800,
        touchAction: "none", userSelect: "none",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
      }}
    >
      <span>{label}</span>
      {sub ? <span style={{ fontSize: size * 0.12, opacity: 0.85 }}>{sub}</span> : null}
    </button>
  );
}
