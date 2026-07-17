# Shitate

**A repository for designing AI-image-generation characters as plain text.**

Manage prompts, worldbuilding, and iteration history as markdown/yaml/json so that the same character can be re-rendered in the image generator of your choice — today and a year from now.

> 日本語版の README は [README.md](README.md) にあります。

---

## Why

- You want to regenerate **the same character**, reliably, months later.
- You want your prompt **iteration history** to survive — what worked, what didn't, what to try next.
- You care about visualizing **historical / mythological figures** grounded in primary sources, not vibes.
- You're tired of prompts living in Discord DMs and random notes.

Shitate does **not generate images**. It is a prompt factory: it turns character concepts + variant requirements + a shared lexicon into a single `prompt.txt` that you can feed into the generator of your choice.

```
primary sources (YouTube / PDF / books / lectures)
    ↓
~/makimono/  (knowledge wiki, optional)
    ↓  read-only
Shitate  (this repo)
    ↓  forge compile → prompt.txt
external generator (Nano Banana / PixVerse / …)
```

## Quick tour

### macOS: open the Studio launcher

1. Install [Node.js 22 or newer](https://nodejs.org/en/download).
2. Download and extract this repository.
3. Control-click **`Shitate Studio.command`**, choose **Open**, and confirm once.

The launcher installs missing dependencies, starts the local Studio, and opens the browser automatically. Character data stays inside this repository. See [QUICKSTART.md](QUICKSTART.md) for troubleshooting.

### Terminal

```bash
git clone <this-repo>
cd shitate
node scripts/launch-studio.mjs

pnpm forge status
pnpm forge compile washi-fox three-view --dry-run
```

See [QUICKSTART.md](QUICKSTART.md) for a 5-minute walkthrough that uses only the sample character shipped in-repo (no `~/makimono` required).
The distributed sample is text-only: no character images or anchors are included.
Run `pnpm distribution:check` before sharing a copy; it rejects character images, non-sample character folders, personal paths, and symlinks.

## How it's structured

```
characters/<id>/
├── index.md                   # character card (name, role, visual core, source_entities)
├── world.md                   # worldbuilding
├── prompts/
│   ├── base.md                # character-wide prompt
│   ├── variants/*.md          # three-view / expressions / poses / scenes …
│   └── history/base.v<N>.md   # versioned baseline
├── references/images/         # anchor images (visual identity lock)
├── outputs/<run-id>/          # compiled prompts + generated artifacts + manifest.json
└── log.md                     # iteration log — evaluation, next improvements
```

`forge compile <character> <variant>` joins `base.md + variant.md + lexicon fragments` into `outputs/<run-id>/{prompt.txt, negative.txt, manifest.json}`. That's the unit you hand to a generator.

## CLI

| Command | Purpose |
|---|---|
| `pnpm forge status` | Overview of every character + "next improvement" from log.md |
| `pnpm forge doctor` | Read-only consistency check |
| `pnpm forge compile <char> <variant>` | Build prompt.txt / negative.txt / manifest.json |
| `pnpm forge compile <char> <variant> --json` | Same, but emit manifest JSON on stdout (CI-friendly) |
| `pnpm forge lint` | Quality gate (`--promotion` for stricter pre-release checks) |
| `pnpm forge index` | Sync INDEX.md character table with reality |
| `pnpm studio` | Local Studio v0.3 UI for authoring, selected-anchor registration, logs, and compile runs (API :5179, UI :5180) |

## Philosophy

- **Plain-text source of truth.** Everything a human edits is markdown / yaml / json. Binaries live only in `references/` and `outputs/`.
- **One character = one directory.** No shared state between characters.
- **Log-driven.** If it's not in `log.md`, it didn't happen. The next session picks up from there.
- **Compile is the boundary.** Shitate stops at `prompt.txt`. Image generation is intentionally out of scope — swap generators freely without touching your characters.

## Related projects

- **[makimono](https://github.com/Takamasa045/makimono)** — upstream knowledge wiki. Shitate reads entities from makimono read-only and translates them into visual characters. Optional but recommended for historically grounded work.

## License

To be selected before public release. No permission to reuse, modify, or redistribute the repository is granted yet.

## Contributing

PRs welcome. CI runs `typecheck / forge lint / forge doctor / compile smoke-test` and posts a **compile diff** comment showing which variants' compiled output changed in your PR. See `.github/workflows/`.
