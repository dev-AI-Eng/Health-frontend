# Clinic Scheduler — dashboard

The web dashboard for the appointment scheduling platform. Reads the Python
API's review endpoints and renders them for clinic staff, in Spanish.

Separate from the backend repository on purpose: it deploys on its own, and
nothing here is imported by the Python code.

## Running it

The API has to be running first (`python main.py` in the backend repository).

```bash
npm install
cp .env.example .env.local     # the defaults are right for a local API
npm run dev                    # http://localhost:3000
```

```bash
npm test          # the failure path, with no server needed
npx tsc --noEmit  # types
npm run build     # production build
npm run lint
```

## How it talks to the API

Every request is made in the Node process, never from the browser. `src/lib/api.ts`
is marked `server-only`, so importing it from a client component is a build
error rather than a review note.

That is not a style choice. The API sends no CORS headers and requires a
loopback `Host`, both deliberate; reaching around either from the browser
would weaken them. Fetching server-side also means a page renders only the
fields it chose to show, which is what role-based access will need.

## Conventions

- **Spanish on screen, English in the code.** Anything a person at the clinic
  reads is Spanish — including every error. The English technical detail goes
  to the server log, which is where `src/lib/load.ts` writes it. `npm test`
  fails if an English message or an internal host reaches a screen.
- **Every page is `force-dynamic`.** The data is a live clinic, so a cached
  render would show one person what another person saw.
- **Identifiers arrive masked** and there is no route that unmasks them; they
  are encrypted at rest in the database.
