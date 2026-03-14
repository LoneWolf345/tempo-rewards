

## Docker-based OpenShift Deployment Setup

Prepare the project for containerized deployment with a multi-stage Dockerfile, supporting files, and documentation.

### Files to Create/Modify

**1. `vite.config.ts`** — Add `preview` block and dynamic import for lovable-tagger
- Add `preview: { host: "::", port: 8080 }` alongside the existing `server` block.
- Change lovable-tagger to a dynamic import so it only loads in development mode (avoids crash in `vite preview`):
  ```ts
  const conditionalPlugins = [];
  if (mode === "development") {
    const { componentTagger } = await import("lovable-tagger");
    conditionalPlugins.push(componentTagger());
  }
  ```

**2. `Dockerfile`** — Multi-stage build
- **Stage 1 (builder)**: `node:22-alpine`, WORKDIR `/app`, copy `package.json`, run `npm install`, copy source, declare `ARG`/`ENV` for all `VITE_*` vars, run `npm run build`.
- **Stage 2 (runtime)**: `node:22-alpine`, WORKDIR `/opt/app-root/src`, copy `dist/`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json` from builder. Install `vite` and `@vitejs/plugin-react-swc` via `npm install --no-save`. Set env vars (`HOME`, `NODE_ENV`, `NPM_CONFIG_CACHE`, `NODE_OPTIONS`). OpenShift UID support (`chown -R 1001:0`, `chmod -R g=u`, `USER 1001`). Install `curl`, add `HEALTHCHECK`. OpenShift labels. `EXPOSE 8080`. `CMD ["npm","run","preview","--","--host","--port","8080"]`.

**3. `.dockerignore`** — Exclude `node_modules`, `dist`, `.git`, `.env`, `supabase/.temp`, `bun.lock`, `bun.lockb`, `package-lock.json`.

**4. `.env.example`** — Document all three `VITE_*` variables.

**5. `README.md`** — Append a "Docker Deployment" section with `docker build --build-arg` and `docker run` examples.

No database or application code changes needed (beyond `vite.config.ts`).

