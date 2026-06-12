# ⚔️ Arena Brawlers (MVP)

A browser-based **online multiplayer arena brawler** inspired by platform-fighter
knockback games. Up to **3 players** fight on a floating low-poly arena — last one
standing wins the round, first to **5 points** wins the match.

- **Server-authoritative** networking (server owns positions, health, damage,
  knockback, round state). Clients send only input + attack requests.
- **Client-side prediction + interpolation** for responsive movement.
- **Knockback-driven combat** — the lower your health, the farther you fly
  (comeback mechanic), exactly like the classics.
- 100% **primitive meshes**, no external art assets, fast loading.

---

## Tech stack

| Layer       | Tech                                                        |
| ----------- | ---------------------------------------------------------- |
| Frontend    | Next.js 15, React 19, TypeScript (strict), Tailwind        |
| 3D          | Three.js, React Three Fiber, Drei                          |
| Networking  | Colyseus (server) + colyseus.js (client)                   |
| Backend     | Node.js + Colyseus game server                             |
| Physics     | Lightweight deterministic kinematic solver (see note below)|

> **A note on physics.** The spec lists Rapier. For a *server-authoritative*
> game the simulation has to run headless in Node and be cheap to predict on the
> client. We implement a small, deterministic kinematic solver
> ([`packages/shared/src/physics.ts`](packages/shared/src/physics.ts)) that both
> the server and the client run with identical constants. It gives the snappy
> "platform fighter" feel, keeps prediction trivial, and is structured behind a
> single `stepKinematics()` function so a heavier engine (or rollback) can be
> dropped in later without touching callers.

---

## Monorepo layout

```
arena-brawlers/
├─ packages/
│  └─ shared/            # weapon configs, constants, network schema, types, physics
├─ apps/
│  ├─ server/            # Colyseus game server (authoritative)
│  │  └─ src/
│  │     ├─ index.ts            # server bootstrap + health endpoints
│  │     ├─ rooms/ArenaRoom.ts  # room: input, combat, crates, sim loop
│  │     └─ game/RoundManager.ts# round/match flow state machine
│  └─ client/            # Next.js + R3F game client
│     ├─ app/            # menu (/) and game (/game) routes
│     ├─ components/     # Scene, PlayerView, ArenaMesh, CameraRig, Hud, ...
│     └─ lib/            # network + input handling
├─ Dockerfile           # builds & runs the game server (Railway/Render)
├─ render.yaml          # Render blueprint
└─ vercel.json          # Vercel config for the client
```

The **shared** package is the single source of truth for weapon definitions,
gameplay constants, the Colyseus schema, and the kinematics — imported by both
client and server so they never disagree.

---

## Local development

Requirements: **Node 20+** and npm.

```bash
# 1. Install everything (also builds the shared package)
npm install

# 2. Run the server + client together
npm run dev
```

- Client: <http://localhost:3000>
- Server: `ws://localhost:2567` (health check at <http://localhost:2567/health>)

The client auto-detects the server at `ws://<hostname>:2567` in development, so no
env config is needed locally.

### Run them separately

```bash
npm run dev:server   # Colyseus server with hot reload (tsx watch)
npm run dev:client   # Next.js dev server
```

### Other scripts

```bash
npm run build         # build shared + server + client
npm run lint          # lint the client
npm run format        # prettier across the repo
npm run build:shared  # rebuild the shared package after editing it
```

> If you edit anything in `packages/shared`, rebuild it (`npm run build:shared`)
> so the server/client pick up the change. `npm run dev` does this for you on
> start.

---

## How to play

1. Open the client, enter a name, click **Create Room**.
2. Share the **6-character room code** shown top-right with up to 2 friends.
3. They click **Join Room**, enter the code, and join.
4. The round starts automatically once **2+ players** are in the room.

### Controls

| Action | Input            |
| ------ | ---------------- |
| Move   | `W` `A` `S` `D`  |
| Jump   | `Space` (double-jump supported for recovery) |
| Dash   | `Shift` (2 s cooldown) |
| Attack | **Left mouse**   |
| Block  | **Right mouse** (hold — 70% damage & knockback reduction, slower, can't attack) |

### Rules

- Everyone starts at **100 HP**. Take damage and you get knocked back **farther**
  the lower your HP gets.
- Die by reaching **0 HP** *or* falling below the arena (`Y < -25`).
- Dead players become **spectators** — the camera keeps following the living.
- Last player alive wins the round (**+1 point**); after 5 s the next round
  auto-starts and the arena resets.
- First to **5 points** wins the match → victory screen with **Play Again** /
  **Return to Menu**.
- **Weapon crates** (Dagger / Sword / Axe / Mace) drop every 10–15 s. Touch one
  to equip it. Default weapon is the **Sword**. Tune all weapon stats in
  [`packages/shared/src/weapons.ts`](packages/shared/src/weapons.ts).

---

## Deployment

The game has two deployable pieces: the **game server** (a long-lived WebSocket
process → Railway/Render) and the **client** (Next.js → Vercel).

### 1. Deploy the game server to Railway

Railway auto-detects the root [`Dockerfile`](Dockerfile).

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo**, pick this repo.
3. Railway builds the `Dockerfile` and starts the server. It injects `PORT`
   automatically (the server reads `process.env.PORT`).
4. Under **Settings → Networking**, generate a public domain. Your server URL is
   `wss://<your-app>.up.railway.app`.
5. Health check path: `/health`.

> No env vars are required for the server. (Optional: set `PORT` if you want a
> fixed port.)

#### Or Render

The repo includes [`render.yaml`](render.yaml). In Render: **New → Blueprint**,
point at this repo, and it provisions a Docker web service with the `/health`
check. Your URL is `wss://<your-app>.onrender.com`.

### 2. Deploy the client to Vercel

The repo includes [`vercel.json`](vercel.json) with `buildCommand: npm run build`.
Vercel auto-detects the Next.js app in `apps/client` and runs the build there;
the client's `prebuild` script compiles the shared package first, so the build
is self-contained.

1. In Vercel: **Add New Project**, import this repo.
2. Leave the **Root Directory** as the repo root — Vercel detects the Next.js app
   under `apps/client` automatically. (If Vercel asks, you may also set the Root
   Directory to `apps/client`; both work because `prebuild` builds the shared
   package.)
3. Add an **Environment Variable**:
   - `NEXT_PUBLIC_SERVER_URL = wss://<your-railway-or-render-domain>`
     (use `wss://` — Vercel is HTTPS, so the WebSocket must be secure).
4. Deploy. Open the Vercel URL and play with friends across different computers.

See [`apps/client/.env.example`](apps/client/.env.example) for the env var. When
unset (local dev) the client falls back to `ws://<hostname>:2567`.

---

## Architecture notes

- **Authority.** The [`ArenaRoom`](apps/server/src/rooms/ArenaRoom.ts) runs a
  fixed 30 Hz simulation. It integrates movement, resolves platform collisions,
  validates every attack (range + facing + weapon cooldown), applies damage and
  knockback, spawns/awards crate pickups, and never trusts client-reported
  damage.
- **Round flow.** [`RoundManager`](apps/server/src/game/RoundManager.ts) is a
  dedicated state machine: `Waiting → Countdown → Playing → RoundEnd →
  (Countdown…) / MatchEnd`. It tracks alive/dead players, scores, and the match
  winner.
- **Prediction.** The client predicts the local player by running the *same*
  `stepKinematics()` as the server each frame and softly reconciles toward the
  authoritative state (snapping only on large error). Remote players are
  position-interpolated. The structure leaves room to add input replay /
  rollback later.
- **Knockback.** `effectiveKnockback = base × (1 + damageTakenPercent)` where
  `damageTakenPercent = (100 − hp) / 100`. Hit-stun briefly disables input
  control so victims sail off cleanly.

---

## Success-criteria checklist

- ✅ 3 players join the same room (by shareable code)
- ✅ Move, double-jump, dash
- ✅ Melee attack with 4 weapons, server-validated
- ✅ Knockback that scales with accumulated damage
- ✅ Weapon crates spawn & equip
- ✅ Blocking (damage/knockback/speed)
- ✅ Death by HP or falling off the map
- ✅ Spectator mode with following camera
- ✅ Auto-restarting rounds + reset arena
- ✅ Scoreboard + round/match messages
- ✅ Match winner victory screen (Play Again / Menu)
- ✅ Fully browser-playable, zero external assets
