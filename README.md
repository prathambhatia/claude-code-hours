# Claude Code Hours

How many hours have you spent in Claude Code? Run one command:

```bash
npx claude-code-hours
```

It reads the log Claude Code already keeps on your computer, prints a summary, and opens your
timesheet at [claude-code-hours.vercel.app](https://claude-code-hours.vercel.app): hours by month, a
day-by-day heatmap, when in the day you work, your records, and an image you can post.

No prompts to answer, no files to pick.

## What it reads, and what leaves your computer

- It reads `~/.claude/history.jsonl` (or `$CLAUDE_CONFIG_DIR/history.jsonl` if you've set it).
  On Windows that's `%USERPROFILE%\.claude\history.jsonl`.
- From each line it keeps two things: **when** the prompt was sent, and the **name of the folder**
  it was sent from (`shop-api`, not `/Users/you/clients/acme/shop-api`). What you typed is never used
  or sent anywhere.
- By default it saves a small summary (hours per day, hours per time of day, your records and your
  top 8 folder names) so you get a short link like `claude-code-hours.vercel.app/r/k3x9pQ7`.
  Short links expire after 90 days.

| Flag | What it does |
|---|---|
| `--private` | Saves nothing online. The summary is packed into the link itself, after the `#`, which browsers never send to a server. The link is longer but works forever. |
| `--hide-projects` | Leaves folder names out entirely. Use this if your folder names are client names. |
| `--no-open` | Prints the link instead of opening a browser. |
| `--json` | Prints the summary as JSON and does nothing else. |

Short links also add your total hours to an anonymous ranking, so the page can say "Top 12% of
Claude Code users" once 100 or more people have taken part. The ranking stores a one-way hash
of your first prompt's timestamp (so re-running replaces your entry instead of adding one), your
latest total, and your git `user.name` (the terminal shows it; `--anonymous` leaves it out). `--private` runs are never ranked.

The site keeps two anonymous daily counts: how many short links were made and how many times
short-link pages were opened. Just the numbers, nothing about who.

Folder names show on the page and on anyone's copy of your link, so check them before you share.
The downloadable image doesn't include them.

## Requirements

Node.js 18 or newer, and some Claude Code history on the machine you run it on.

## Not affiliated with Anthropic

This is an independent tool. "Claude" and "Claude Code" are Anthropic's names for their products.

## License

MIT. The bundled Archivo font is under the SIL Open Font License (`site/fonts/OFL.txt`).
