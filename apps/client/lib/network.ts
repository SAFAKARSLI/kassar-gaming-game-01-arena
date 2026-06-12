import { Client, Room } from 'colyseus.js';
import type { ArenaState } from '@arena/shared';

/**
 * Resolve the Colyseus endpoint. In production set NEXT_PUBLIC_SERVER_URL to the
 * deployed game server (e.g. wss://your-app.up.railway.app).
 */
export function serverEndpoint(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SERVER_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.hostname}:2567`;
  }
  return 'ws://localhost:2567';
}

export function createClient(): Client {
  return new Client(serverEndpoint());
}

export type ArenaRoom = Room<ArenaState>;

/** Create a new room (host) or join an existing one by code. */
export async function connectToRoom(
  host: boolean,
  code: string,
  name: string,
): Promise<ArenaRoom> {
  const client = createClient();
  const options = { code, name };
  if (host) {
    return client.create<ArenaState>('arena', options);
  }
  return client.join<ArenaState>('arena', options);
}
