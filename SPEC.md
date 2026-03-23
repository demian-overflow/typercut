# typercut — SpeedTyper Spec

## Overview

A focused speed-typing practice app. The core loop: AI generates text on a topic you choose → you type it → you see your stats.

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Storybook (component dev + docs)
- Anthropic SDK (`claude-opus-4-6`, `dangerouslyAllowBrowser`)

## User Flow

```
[Topic Input] → [Generate] → [Typing Exercise] → [Results] → [Try Again / New Topic]
```

## Components

### `TextGenerator`

Inputs:
- **Topic** — free text (e.g. "React hooks", "Japanese history", "Go concurrency")
- **Style** — `prose` | `quotes` | `code` (default: `prose`)
- **Length** — `short` (~30 words) | `medium` (~60 words) | `long` (~120 words)

Behavior:
- Calls Claude to generate a typing-appropriate passage on the topic
- Shows a loading state while generating
- Surfaces errors (missing API key, network failure)

Claude prompt strategy:
- System: "Generate a typing exercise. Use clear, accurate, engaging language. No markdown, no headers. Return only the text to type."
- User: "Topic: {topic}. Style: {style}. Target length: {length} words."

### `SpeedTyper`

Props: `text: string`, `onComplete: (stats: TypingStats) => void`

State machine:
- `idle` — shows text, cursor at position 0, waiting for first keypress
- `typing` — timer running, user entering characters
- `done` — all characters correctly typed; shows stats + actions

Keyboard handling:
- Any printable character → record correct/incorrect vs expected char
- `Backspace` → undo last character (correcting is allowed)
- `Escape` → reset to idle
- Incorrect characters allowed (marked red) — user must backspace to fix or continue
- Completion triggers only when all characters are correct

Display:
- Monospace font, characters colored: gray (pending) / green (correct) / red (incorrect)
- Blue underline cursor on current position
- Live WPM and accuracy stats while typing

### `ResultsPanel`

Shows on completion:
- **WPM** — gross WPM: (total chars typed / 5) / elapsed minutes
- **Accuracy** — correct keypresses / total keypresses × 100%
- **Time** — elapsed seconds
- Actions: "Try Again" (same text) | "New Text" (back to generator)

## Data Types

```ts
type TextStyle = 'prose' | 'quotes' | 'code';
type TextLength = 'short' | 'medium' | 'long';
type TypingState = 'idle' | 'typing' | 'done';

interface TypingStats {
  wpm: number;
  accuracy: number;
  durationSeconds: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
}

interface CharState {
  char: string;
  status: 'pending' | 'correct' | 'incorrect';
}
```

## Environment

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

The API key is read from `import.meta.env.VITE_ANTHROPIC_API_KEY`. The Anthropic client is initialized with `dangerouslyAllowBrowser: true` — acceptable for a local dev tool.

## Storybook Stories

- `SpeedTyper` — idle, mid-typing (via play function), completed
- `TextGenerator` — default, loading state, error state
- `ResultsPanel` — example stats

## Future Ideas

- Persist best scores per topic in localStorage
- Highlight mistake patterns (which chars are most often mistyped)
- Leaderboard mode (same text, race against time)
- Paste custom text instead of AI generation


# GitHub Repo Ingestion

## Overview

User pastes a GitHub URL → backend fetches & processes the repo → creates a `Material` + `Snippet`s ready to type.

## Pipeline

```mermaid
flowchart TD
    A[POST /materials/from-github\n{url}] --> B{Validate URL\ngithub.com?}
    B -->|no| ERR1[422 Invalid URL]
    B -->|yes| C[GitHub API\nfetch repo tree\nGET /repos/:owner/:repo/git/trees/:sha?recursive=1]
    C -->|404/403| ERR2[404 Repo not found\nor private]
    C --> D[Filter files\n.md .txt .rs .go .ts .py etc.\nskip binaries, vendor, node_modules]
    D --> E[Fetch file contents\nGitHub raw API\nbatch, cap at 50 files]
    E --> F[Flatten & clean\nstrip markdown headers\nnormalise whitespace]
    F --> G[Build material\ntitle = owner/repo\ncontent = concatenated text]
    G --> H[db::materials::create]
    H --> I[action_pool /v1/ingest/process\nsplit into typing snippets via Claude]
    I --> J[db::snippets::insert_batch]
    J --> K[201 MaterialDto + snippets]
```

## Decisions

- **File types:** `.md`, `.txt`, `.rs`, `.go`, `.ts`, `.js`, `.py`, `.java`, `.c`, `.cpp`
- **Skip:** `vendor/`, `node_modules/`, `dist/`, binaries, files > 50KB each
- **Size cap:** stop fetching once accumulated content reaches 100KB
- **GitHub auth:** `GITHUB_TOKEN` env var — optional, used when set (higher rate limits, private repos)
- **Private repos:** supported if `GITHUB_TOKEN` is present, otherwise 404 passthrough
- **Snippet splitting:** reuses existing `create_and_process` → action_pool → Claude

## Implementation location

Entirely in the Rust backend (`src/materials/routes.rs` + a new `src/github.rs` module). No action_pool involvement in fetching — action_pool is only called for the snippet-splitting step, same as other material sources.

# Agent knowledge system
```mermaid
flowchart TD

A[GitHub Repo] --> B[File Parsing]

B --> C[Code + Docs Extraction]
C --> D[AST + Semantic Analysis]

D --> E[Concept Nodes]
D --> F[Relation Edges]

E --> G[Knowledge Graph]
F --> G

G --> H[Multi-Level Representations]

H --> I[Beginner Layer]
H --> J[Intermediate Layer]
H --> K[Expert Layer]

G --> L[Agent Reasoning Engine]

L --> M[Query Understanding]
M --> N[Graph Traversal]

N --> O[Context Assembly]

O --> P[Response Generator]

P --> Q[Explain in Any Language + Level]
```

Most systems do Repo → chunks → embeddings → retrieval. We do Repo → concepts → relationships → structured reasoning → adaptive explanation.
