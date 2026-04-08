<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BelegPilot — Agent-Anleitung

## Projekt
- Pfad: `c:\Users\AliSe\OneDrive\Dokumente\Claude Projects\Bookkeeping Automation\belegpilot`
- Repo: https://github.com/as79509/belegpilot

## Befehle
- `npm run dev` — Entwicklungsserver (Port 3000)
- `npm run build` — Produktions-Build
- `npm run test` — Vitest Tests (34 Tests)
- `npx tsc --noEmit` — TypeScript-Prüfung
- `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` — Inngest DevServer

## Regeln
- Immer volle Pfade in Terminal-Commands verwenden
- Max 5-6 Dateien pro Prompt ändern
- Nach jedem Prompt: `npx tsc --noEmit` + `npm run build`
- Immer `git add -A && git commit -m "..." && git push origin main` am Ende
- `.env` niemals committen — `git check-ignore .env` verifizieren
- Prisma 7: Generator ist `prisma-client`, Import aus `@/generated/prisma/client`
- Next.js 16: `params` ist async (`await params`), `middleware.ts` deprecated (funktioniert aber noch)
