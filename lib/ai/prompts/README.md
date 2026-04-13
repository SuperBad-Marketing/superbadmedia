# `lib/ai/prompts/` — canonical prompt stubs

Every LLM prompt Lite runs at runtime has its canonical text living **here**, not inline in a spec.

## Why

Prompts drift when content mini-sessions refine the text but spec prose stays stale (or vice versa). This folder is the single source of truth. Spec prose describes **intent** only; prompt **text** lives in the file referenced from the spec.

## Convention (Phase 3.5 step 3b, 2026-04-13)

- **One file per spec** that owns prompts: `lib/ai/prompts/<spec-slug>.md` (e.g. `quote-builder.md`). Each file has one `## <prompt-slug>` section per prompt.
- Spec-level reference: each prompt-heavy spec has a `## Prompt files` heading pointing at its file here. Phase 5 build sessions load spec + referenced file together.
- Stub state today: files contain prompt **intent** + input/output shape from the spec. Canonical prompt **text** is written by each spec's content mini-session into the matching section here (not into the spec).
- Phase 4 foundation session: splits each file into per-prompt `.ts` files (`lib/ai/prompts/<prompt-slug>.ts`) as TypeScript scaffolding lands. At that point the `.md` files are archived under `lib/ai/prompts/_archived/`.

## Model registry

Prompt files don't name the model — that's the LLM model registry's job (`lib/ai/models.ts`, Phase 4 foundation). Each prompt is keyed by job name in the registry; the registry decides Haiku vs Opus vs Sonnet. See FOUNDATIONS.md §11.6.

## Index

`INDEX.md` lists every prompt across every spec with its job name, owner spec, and one-line intent. Use it as the discovery entry point when wiring a Phase 5 build session.
