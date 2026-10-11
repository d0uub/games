/// <reference types="vite/client" />

declare module "trystero" {
  export type JsonValue =
    | null | string | number | boolean | JsonValue[] | { [k: string]: JsonValue };
  export type DataPayload = JsonValue | ArrayBuffer | ArrayBufferView;
  export type PeerTarget = string | string[] | null;
  export interface SendOptions { target?: PeerTarget; metadata?: JsonValue; }
  export interface MessageContext { peerId: string; metadata?: JsonValue; }
  export interface MessageAction<T = DataPayload> {
    send: (data: T, options?: SendOptions) => Promise<void>;
    onMessage: ((data: T, context: MessageContext) => void | Promise<void>) | null;
  }
  export interface Room {
    makeAction: { <T = DataPayload>(namespace: string): MessageAction<T> };
    leave: () => Promise<void>;
    getPeers: () => Record<string, RTCPeerConnection>;
    onPeerJoin: ((peerId: string) => void) | null;
    onPeerLeave: ((peerId: string) => void) | null;
  }
  export interface JoinRoomCallbacks { onError?: (err: unknown) => void; }
  export const selfId: string;
  export const joinRoom: (
    appId: string, roomId: string, callbacks?: JoinRoomCallbacks
  ) => Room;
}

declare module "nipplejs" {
  export interface NippleVector { x: number; y: number; }
  export interface NippleEventData {
    vector: NippleVector; // normalized -1..1
    force: number; // 0..1
    position: { x: number; y: number };
    distance: number;
    instance: unknown;
  }
  export interface NippleCollection {
    on: (event: string, cb: (data: NippleEventData | unknown) => void) => NippleCollection;
    off: (event?: string, cb?: (data: NippleEventData | unknown) => void) => NippleCollection;
    destroy: () => void;
    reposition: () => void;
  }
  export interface NippleCreateOptions {
    zone?: HTMLElement | string;
    mode?: "dynamic" | "semi" | "static";
    size?: number;
    color?: string;
    dataOnly?: boolean;
    position?: { x?: string; y?: string };
    [key: string]: unknown;
  }
  export function create(options: NippleCreateOptions): NippleCollection;
  const nipplejs: { create: typeof create };
  export default nipplejs;
}
