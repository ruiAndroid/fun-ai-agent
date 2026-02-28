# fun-ai-agent

Frontend admin console for managing claw instances.

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Ant Design
- Nextra docs theme

## Run

```bash
npm install
npm run dev
```

Set API endpoint:

```bash
src/config/app-config.ts
```

Edit `controlApiBaseUrl`, for example:

```ts
export const appConfig = {
  controlApiBaseUrl: "http://127.0.0.1:8080",
} as const;
```

## Routes

- Dashboard: `http://localhost:3000/`
- Docs portal (Nextra): `http://localhost:3000/docs`

## Update Script

Use `update-agent.sh` for one-command update on server:

```bash
chmod +x /opt/fun-ai-agent/update-agent.sh
/opt/fun-ai-agent/update-agent.sh
```

Optional environment variables:

- `APP_DIR` (default: `/opt/fun-ai-agent`)
- `SERVICE_NAME` (default: `fun-ai-agent-web`)
- `GIT_REMOTE` (default: `origin`)
- `GIT_BRANCH` (default: `main`)
- `HEALTH_URL` (default: `http://127.0.0.1:3000`)
- `NPM_CMD` (default: `npm`)
