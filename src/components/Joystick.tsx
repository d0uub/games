import { useEffect, useRef } from "react";
import nipplejs, { type NippleEventData } from "nipplejs";

export interface Stick {
  x: number; // -1..1, forward positive
  y: number; // -1..1, left negative / right positive
  force: number; // 0..1
  active: boolean;
}

interface Props {
  onChange: (s: Stick) => void;
  className?: string;
  size?: number;
}

const NONE: Stick = { x: 0, y: 0, force: 0, active: false };

// Touch joystick built on nipplejs. Renders into a zone div and reports a
// normalized vector via onChange while a stick is active.
export default function Joystick({ onChange, className, size = 120 }: Props) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const activeRef = useRef(false);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const collection = nipplejs.create({
      zone,
      mode: "dynamic",
      size,
      color: "cyan",
      dataOnly: false,
    });
    const report = (e: unknown) => {
      const ev = e as NippleEventData;
      activeRef.current = true;
      onChangeRef.current({
        x: ev.vector.x,
        y: ev.vector.y,
        force: ev.force,
        active: true,
      });
    };
    collection.on("move", report);
    collection.on("dir:up", report);
    collection.on("dir:down", report);
    collection.on("dir:left", report);
    collection.on("dir:right", report);
    collection.on("end", () => { activeRef.current = false; onChangeRef.current(NONE); });
    return () => { collection.destroy(); };
  }, [size]);

  return (
    <div
      ref={zoneRef}
      className={className}
      style={{
        width: size,
        height: size,
        touchAction: "none",
        userSelect: "none",
        position: "relative",
      }}
    />
  );
}
