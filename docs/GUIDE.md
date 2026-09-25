# docdeck — writing guide for its own document

- Audience: developers and delivery leads deciding whether to use docdeck for
  a client project. They know Markdown and a terminal.
- Words: "deck", "book", "chapter", "block", "provider", "theme role". Say
  "the project" for the product being documented.
- Every table about the engine comes from `docs/providers.ts`, which reads
  the engine's own code. Update the provider, not the chapter, when the
  engine changes.
- The deck tells the story in about 25 slides. Detail goes in `:::book`.
