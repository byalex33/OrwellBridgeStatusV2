# Orwell Bridge Status

Independent traffic dashboard for the A14 Orwell Bridge near Ipswich. This is an unofficial service: check [National Highways](https://www.trafficengland.com/) before travelling. Missing or old observations are not evidence that a road is open.

- Live site: https://www.orwellbridgestatus.com/
- Repository: https://github.com/byalex33/OrwellBridgeStatusV2
- Existing Vercel project: https://vercel.com/byalex34/orwell-bridge-status-v2

## Local setup

Use Node.js 22 LTS and npm. The app uses Next.js 15, React 19, TypeScript and Tailwind CSS.

```sh
git clone https://github.com/byalex33/OrwellBridgeStatusV2.git
cd OrwellBridgeStatusV2
npm ci
```

Copy `.env.example` to `.env.local`, fill in the available server-side credentials, then run `npm run dev` and open http://localhost:3000. Never commit `.env.local` or put keys in `NEXT_PUBLIC_` variables. Open-Meteo requires no key for the endpoint used here; `WEATHER_API_KEY` is not read.

| Variable | Purpose |
| --- | --- |
| `TOMTOM_API_KEY` | TomTom Traffic Flow API; requests speeds in mph. |
| `HERE_API_KEY` | Optional HERE Traffic API directional evidence. |
| `NATIONAL_HIGHWAYS_API_KEY` | Optional National Highways incident feed key. |
| `MONGODB_URI` | MongoDB Atlas or replica-set connection for recorded events and historical fallback. |

At least one usable traffic provider is needed for live traffic. Providers can fail independently; history is optional for live observations. A missing database makes event history unavailable. Configure only keys supported by the implementation; do not substitute unrelated API product keys.

## Behaviour and validation

- `GET /api/bridge-status`: latest traffic observation and freshness/source metadata. Historical fallback is not a current directional observation.
- `GET /api/events`: recorded events; failures are distinguished from an empty result.
- `GET /api/weather`: Open-Meteo model estimate. Mean wind is not a bridge gust measurement or an official restriction notice.
- Caches live in memory within one running instance. Separate serverless instances do not share a cache.
- Legacy history may have no speed unit or reliable direction; do not infer missing metadata.

```sh
npm run lint
npx tsc --noEmit
npm run build
```

Run the regression scripts in `scripts/check-*.cjs` with Node after the build. Configure an operational monitor and its notification recipient before relying on automated availability alerts. No alert recipient is configured by the credential template.

## Deployment

### Install on a phone (PWA)

Serve over HTTPS (localhost also works for development). In Safari on iPhone/iPad, use Share → Add to Home Screen, enable Open as Web App if offered, then Add. In Chrome on Android, use the menu → Install app / Add to Home screen. The dashboard includes these instructions and hides them when opened in standalone mode.

The Next.js manifest supplies the name and 192/512px icons. The service worker registers without requesting notifications. After its first online activation, failed page navigations show an offline message with a retry link. It never caches live pages or API responses; current bridge conditions require an internet connection.

Run `node scripts/check-pwa.cjs` for manifest, icon and worker checks. After deployment, install on a real phone and reopen in airplane mode to verify the offline screen.

### Hosting

Use the existing Vercel project linked above. Check the project name and connected repository before importing or linking a checkout: a local `.vercel` directory can refer to a different project. Put server credentials in that project's environment settings with the intended Production/Preview scope. When deployment is enabled, pull requests create previews and merging to `master` deploys production through the GitHub integration. Respect paused deployments; canceled or missing deployment checks do not prove that a release passed.

Open issues and pull requests in the repository linked above. Traffic evidence is provided by configured TomTom, HERE and National Highways integrations; weather estimates come from Open-Meteo.
