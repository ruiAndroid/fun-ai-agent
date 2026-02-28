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
  controlApiBaseUrl: "/fun-claw/api",
  defaultHostId: "00000000-0000-0000-0000-000000000098",
} as const;
```

`defaultHostId` is the fixed host UUID used when creating instances in single-host deployments.

## Routes

- Dashboard: `http://localhost:3000/fun-claw`
- Docs portal (Nextra): `http://localhost:3000/fun-claw/docs`
