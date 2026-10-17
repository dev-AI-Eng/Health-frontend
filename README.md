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
npm test          # the failure path, no server needed
npm run e2e       # the whole thing in a browser, both services running
npx tsc --noEmit  # types
npm run build     # production build
npm run lint
```

`npm run e2e` drives a real browser against both services, because the write
path cannot be tested any other way: a Server Action is invoked over React's
own protocol, not as a plain form POST.

```bash
python main.py               # in the backend repository
npm run build && npm start   # here
npm run e2e
```

**`npm start` serves the build it started with.** Rebuild and it keeps serving
the old one until restarted, which reports failures that are not real.

Five of the browser tests sign in as an administrator, and the password comes
from the environment rather than from the test files -- a literal there is the
first thing a secret scan flags, and rule 6 of the backend's CLAUDE.md names a
test fixture as a place a secret must never be written. Use the same value the
API has in its own `.env`:

```bash
REVIEW_ADMIN_PASSWORD=... npm run e2e
```

Unset, those five skip rather than fail: a missing local credential is not a
broken dashboard. The tests that assert the *masked* view still run, so an
absent password cannot turn the masking guarantee green by accident.


## The conversation simulator (M3)

`/conversation` drives the real conversation graph: identification from the
phone number, consent, intent, tools, and the four-stage safety gate.

It is a **review surface**, not a chat window. A reply alone would prove the
pipeline emits Spanish; M3's exit criteria are about the gate, so the screen
also shows every draft attempt with its verdict, the quoted text that caused
each refusal, the retry count, and the verified facts the reply was allowed to
state. That last panel is the only way to see rule 4 holding — that the message
contains nothing a tool did not establish.

Built here rather than on a hosted bot tester for one deciding reason: a hosted
tool means conversation content leaving the machine, and only synthetic data is
permitted. It also reuses the clinic scope and auth already present.

```bash
npx playwright test e2e/conversation.spec.ts   # 10 tests over the real screen
```

## How it talks to the API

Every request is made in the Node process, never from the browser. `src/lib/api.ts`
is marked `server-only`, so importing it from a client component is a build
error rather than a review note.

That is not a style choice. The API sends no CORS headers and requires a
loopback `Host`, both deliberate; reaching around either from the browser
would weaken them. Fetching server-side also means a page renders only the
fields it chose to show, which is what role-based access will need.

## Writing, not just reading

The browser never calls the Python API — it cannot, and that is deliberate: the
API sends no CORS headers and requires a loopback `Host`. Every write goes
through a Server Action in `src/lib/actions.ts`, which runs in this Node
process.

Actions return a result object rather than throwing, because the answer is
usually what the user needs to see. A 409 from the scheduling routes means
another patient took that time first — the request was fine, and the screen
says so in Spanish rather than showing an error.

## Conventions

- **Spanish on screen, English in the code.** Anything a person at the clinic
  reads is Spanish — including every error. The English technical detail goes
  to the server log, which is where `src/lib/load.ts` writes it. `npm test`
  fails if an English message or an internal host reaches a screen.
- **Every page is `force-dynamic`.** The data is a live clinic, so a cached
  render would show one person what another person saw.
- **Identifiers arrive masked** and there is no route that unmasks them; they
  are encrypted at rest in the database.
