# Domain Docs

## Before exploring

- Read `CONTEXT-MAP.md` at the repository root.
- Read each context-specific `CONTEXT.md` relevant to the work.
- Read system-wide ADRs under `docs/adr/`.
- Read context-specific ADRs under the relevant context directory.

If these files do not exist, proceed without creating them upfront.

## Vocabulary

Use the glossary vocabulary from the relevant context when naming domain concepts. If a needed term is missing or ambiguous, record it for domain modeling.

## ADR conflicts

If proposed work conflicts with an ADR, identify the ADR explicitly rather than silently overriding it.

## Multi-context layout

The repository uses a root `CONTEXT-MAP.md` pointing to context-specific `CONTEXT.md` files, with system-wide and context-specific ADR directories where needed.
