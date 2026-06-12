/**
 * Colyseus game server bootstrap.
 *
 * Exposes the "arena" room (filtered by a shareable 6-char code) plus a health
 * endpoint for Railway / Render.
 */

import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ArenaRoom } from './rooms/ArenaRoom';

const port = Number(process.env.PORT ?? 2567);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ service: 'arena-brawlers-server', status: 'ok' });
});

app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

const httpServer = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// Players join by 6-char code; filterBy routes "join" requests to the room that
// was created with the matching `code` option.
gameServer.define('arena', ArenaRoom).filterBy(['code']);

gameServer
  .listen(port)
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`⚔️  Arena Brawlers server listening on ws://localhost:${port}`);
  })
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err);
    process.exit(1);
  });
