# version crawler

Find what version of your package is used in a given repository.

## Demo

- [version-crawler.47ng.com](https://version-crawler.47ng.com/docs)
- Example: [TheOrcDev/8bitcn-ui/nuqs](https://version-crawler.47ng.com/TheOrcDev/8bitcn-ui/nuqs)

## Development

To start the development server, run:

```bash
bun run dev
```

Open http://localhost:3000/ with your browser (if it has a [nice JSON renderer](https://www.firefox.com))
to see the result, otherwise `curl + jq`:

```bash
curl https://version-crawler.47ng.com/TheOrcDev/8bitcn-ui/nuqs | jq '.'
```

## About this project

I built a service (not yet OSS, will be soon) to fetch a leaderboard
of the most popular OSS repos that use [nuqs](https://nuqs.dev).

![A list of project icons in a grid](./dependents.png)

Keeping track of star counts & repository metadata is simple enough,
but I wanted to also know **what version of nuqs** they were using,
to identify patterns and opportunities to open PRs to upgrade older versions
(especially for [sponsors](https://github.com/sponsors/franky47)).

The GitHub code search API has very strict rate limits (10 req/min),
meaning it would take 5 hours to go over the ~3000 dependents I have on record.

Instead of brute-force code search (which can lead to false positives),
I wanted to try another way:

1. Get a recursive tree for the given repo using the GitHub API
2. Identify relevant files (`package.json` & lockfiles)
3. Fetch those from the GitHub public CDN
4. Extract the nuqs version(s) information
5. Provide a link back to that line in the file

This allows getting high-fidelity results, without AI, and in a single API call.

## Tech Stack

But really, this was just a pretext to play with [Bun](https://bun.com) &
[Elysia](https://elysiajs.com/).

I had a [tweet about it](https://x.com/nuqs47ng/status/1991618158583771524) mildly blow up,
and it got me more curious about that combo to build backend services
(I still love Node.js + Fastify 🫶).

The result so far: Bun is _so fr\*\*\*\*ing fast_ 🤯

Not just in req/sec (I don't particularly care in this case), but for the DX:

- Instant code reload / server restart
- Sub-second package installs
- Sub-second unit tests
- CI completes in ~10s

The unexpected side-effect of speed is that it makes agentic coding much more enjoyable.
No more having the agent stuck in a `wait 5 && ls -la` loop.

Elysia is really nice too, the focus on type-safety is something
I want to play with a bit more, and see how it scales in terms of code organisation,
community plugins, and overall DX.

## Disclaimer

This project was mostly vibe-coded [^1] by GitHub Copilot + Claude Sonnet 4.5,
as I don't have enough free time to spend on this side-project.

This README (from About down to here) was written by hand without tab completion.

[^1]:
    In the sense that the LLM wrote the code, but I reviewed it
    and directed it with tests. Vibe-engineering would be a better term.
