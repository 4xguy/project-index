Here’s a distilled, detailed reconstruction of Eric’s “Indexer” (aka “Project Index”) hook as described in the video, plus some inferred implementation details to help you rebuild it.

What the Indexer/Project Index does
- Core purpose: Maintain a continuously updated, compact, high-signal “map” of your entire project that Claude Code and sub-agents can consult to:
  - Identify only the relevant files and even lines for a given change/request.
  - Avoid missing dependencies and reduce redundant or mislocated changes in large repos.
  - Preserve Claude’s context by pushing heavy project-awareness outside the chat into a lightweight index file.[1]

- Output artifact: A single file at the project root, typically named PROJECT_INDEX.json (uppercase in Eric’s description), containing:
  - The directory tree (excluding .gitignored files).
  - Per-file metadata: path, imports/dependencies, exported symbols, function/method signatures, types, constants, and perhaps top-level docstrings/comments.
  - A minified/abstracted representation of each file (not obfuscated/minified JS; think UML-like summaries) sufficient to reason about structure and references without flooding context.[1]

- Always-on maintenance: A hook runs outside Claude’s context and updates the Project Index every time a file changes (watcher). Claude doesn’t “know” the hook exists; it just benefits from the updated index file when prompted. This ensures:
  - Zero context pollution from the hook itself.
  - Fresh structural knowledge without re-parsing the whole repo in-session.[1]

Why it’s valuable
- High signal, low noise: Models work best when given only what’s relevant. The index lets you extract just the subset needed for a task rather than dumping entire files or overusing the search tool across a huge codebase.[1]
- Fewer “refactor-in-the-wrong-place” errors: In large projects, models may add new code beside similar code instead of refactoring shared logic. The index helps them resolve where the canonical pieces live.[1]
- Scaling beyond “fits-in-context” projects: For small repos, Claude’s file search works fine; for big ones, the index is a “bulletproof-ish” fix to keep quality high.[1]

How it plugs into the workflow
- Background hook process:
  - Watches file changes (fsnotify/inotify/etc.).
  - On change, parses the file, updates the PROJECT_INDEX.json incrementally.[1]
- Usage by Claude/sub-agents:
  - You can instruct Claude or a sub-agent to “read the project index and determine the minimal set of files/lines required for this change.”
  - A common pattern Eric uses:
    1) After completing a task, run a cleanup slash command that updates docs and plans the next phase.
    2) Clear the session (protect context).
    3) Run a “fresh” command that tells Claude to read the updated docs plus the full Project Index (only the compacted form) so it starts with a crisp mental model for the next step.[1]
- Separation of concerns:
  - Hooks run outside Claude and don’t consume context.
  - Slash commands direct Claude’s behavior and can pass arguments (e.g., “fresh”, “cleanup”).
  - Sub-agents can read the index to scope their work and then pass only relevant snippets back to the main agent, preserving the main context.[1]

Data model details to implement
- Project-level fields:
  - projectRoot, createdAt, updatedAt
  - toolVersion/schemaVersion (to evolve without breaking old indexes)
- File entries (for each non-ignored file):
  - path (repo-relative)
  - language or fileType
  - size, hash (quick invalidation)
  - imports/dependencies (normalized module paths)
  - exports/public API (functions, classes, constants)
  - top-level symbols and signatures (names, params, return types)
  - top-level comments/docstrings (trimmed)
  - outline: array describing file structure by ranges (start/end lines)
  - inferred roles/tags (e.g., “React component”, “Express route”, “DB migration”)
  - lastIndexedAt
- Cross-file maps (optional but powerful):
  - dependencyGraph: edges by file path
  - symbolIndex: symbol → file(s), definition locations
  - routeIndex/API map (for web backends)
  - uiIndex (component names → files)
- Size management:
  - Strip bodies; keep signatures and summary comments.
  - Store short hash for each file; only re-parse on change.
  - Optionally shard to PROJECT_INDEX/*.json if single file gets too large, with a root manifest.

Hook mechanics
- Trigger points:
  - File system watcher for changes.
  - Manual CLI command to force full reindex.
- Pipeline:
  1) Change detected → classify file type.
  2) Parse using language-aware parsers (tree-sitter, ts-morph for TS, go/parser, py ast, etc.).
  3) Extract: imports/exports, symbol table, signatures, top-level comments, inferred roles.
  4) Update PROJECT_INDEX.json incrementally.
- Performance:
  - Debounce rapid changes, batch writes.
  - Cache per-file parse results by content hash.

How Claude consumes the index
- Prompts and commands:
  - “Read PROJECT_INDEX.json and decide which files and line ranges are relevant to implement X.”
  - “Before making changes, list files you will read and why, using the index as your guide.”
  - “If a new symbol resembles an existing one in the index, refactor the existing code instead of adding duplicates.”
- Sub-agent pattern:
  - Spawn a research sub-agent: “From PROJECT_INDEX.json, produce the minimal change set with exact line ranges to edit.” The sub-agent returns a concise plan to the main agent, which then executes edits with fewer mistakes.[1]

Differences vs. Docs hook and slash commands
- Docs hook: Eric also has a docs setup that fetches Anthropic Claude Code docs locally, and a hook that runs git fetch/pull before answering a /docs request, ensuring the local docs are current. That is separate from the Indexer but follows a similar principle: pull heavy, changing context into files outside Claude’s context and fetch updates automatically.[1]
- Slash vs. Hook choice:
  - Hooks: automate background work without polluting context (good for indexing, syncing docs, guardrails).
  - Slash commands: give Claude direct, high-priority instructions and pass arguments (good for “fresh”, “cleanup”, “docs” queries).[1]

Practical setup notes
- One-line installer: Eric says both the Claude Code Docs tool and his Project Index can be installed with a simple installer; once the index exists, the hooks install and keep it updated automatically. The Project Index repo isn’t public at the moment, but he could share it; the Claude Code Docs repo is public.[1]
- Naming and discovery:
  - Place PROJECT_INDEX.json at repo root.
  - Ensure your hook detects that file’s presence to activate indexing for that project.[1]

Recommended guardrails and enhancements (deduced/good practice)
- Language-aware parsers:
  - TS/JS: ts-morph or Babel parser to extract exports, types, React components, routes.
  - Python: ast module for defs/classes/imports.
  - Go: go/parser for AST-level signatures and imports.
  - Java/Kotlin: use tree-sitter or appropriate parsers for signatures.
- Heuristics:
  - For web apps, derive route maps from server/router files, attach to index.
  - For frontends, map components to usage and co-located styles.
- Line range hints:
  - Store line spans per symbol; this allows sub-agents to propose precise line edits rather than whole-file diffs.
- Safety checks:
  - Hook-level path allow/deny lists to avoid YOLO-mode risks in sensitive directories (Eric notes hooks can block certain actions outside Claude).[1]
- Size limits:
  - Keep the index compact; consider separate “heavy” sidecar files for large generated maps (symbolIndex.json), with the main PROJECT_INDEX.json referencing them.
- Versioning:
  - Include schemaVersion and toolVersion; write a migration routine for older index files.

How to reconstruct it quickly
- MVP
  1) Create a CLI “indexer” that:
     - Walks the repo (respect .gitignore).
     - For each file, extracts:
       - Imports, exports, top-level defs (name, params, returns), first docstring/comment, and a brief “role” guess.
     - Produces PROJECT_INDEX.json and stores file hashes.
  2) Add a watcher to update entries on change.
  3) Add a hook that runs the indexer on change events (outside Claude), no context injection.
  4) Teach Claude/sub-agents a prompt convention:
     - “Consult PROJECT_INDEX.json to plan minimal file set and line ranges before editing.”
- v2
  - Add cross-file dependency graph, symbol index, route maps.
  - Add slash commands: /cleanup (update docs/plan), /fresh (ingest docs + Project Index), and arguments support for phase planning.
  - Add a “minimal change set planner” sub-agent that reads the index and returns a precise change list.

Key mental model
- The Project Index is a compact, evolving “project brain” maintained by hooks. Claude queries that brain on demand to stay sharp without flooding its chat context. Hooks = automation and structure without context cost; Slash commands/sub-agents = targeted control and scoped execution.[1]

References to the video segments supporting these points:[1]

[1] https://www.youtube.com/watch?v=JU8BwMe_BWg