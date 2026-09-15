# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state is recorded with a `Status:` line near the top of each issue file
- Comments and conversation history append under a `## Comments` heading

## Publishing and fetching

When a skill says to publish to the issue tracker, create the appropriate Markdown file under `.scratch/<feature-slug>/`.

When a skill references a ticket, read the referenced path.

## Wayfinding

Wayfinding maps live at `.scratch/<effort>/map.md`, with child tickets under `.scratch/<effort>/issues/`.
