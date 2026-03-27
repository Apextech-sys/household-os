# ADR-002: AI Model Strategy — Task-Optimised Multi-Model Architecture

**Status:** Accepted  
**Date:** 2026-03-28  
**Author:** Docs

---

## Context

HouseholdOS is deeply AI-dependent. Every core workflow — document OCR, natural language Q&A, action proposal, semantic search — requires AI inference. The platform needs models that are accurate, fast, cost-effective, and available at scale.

Three distinct AI task categories exist in the system:
1. **Vision/OCR and structured extraction** — reading scanned documents, PDFs, receipts, bank statements, and extracting structured data
2. **Conversational Q&A** — streaming responses to household questions, document summaries, advisor-style explanations
3. **Semantic search and retrieval** — embedding documents and queries for vector similarity search

A single-model approach would force compromise: either overpay for every task by using the most capable model, or underperform on complex extraction by using a cheaper one. HouseholdOS processes documents with handwriting, tables, mixed languages, and variable SA-specific formats (municipal bills, insurance schedules) — this requires top-tier vision capability.

---

## Decision

**Three models, three jobs:**

| Task | Model | Rationale |
|------|-------|-----------|
| OCR, vision, structured extraction | Claude Opus (claude-opus-4-5) | Highest accuracy on complex document layouts, SA-specific formats, handwritten content |
| Streaming conversational Q&A | Claude Sonnet (claude-sonnet-4-5) | Fast TTFB, lower cost, sufficient for Q&A on pre-extracted structured data |
| Text embeddings for vector search | OpenAI text-embedding-3-small | Best-in-class embedding quality, stable API, 1536-dimension vectors |

All AI calls are server-side only. No API keys reach the client. The Vercel AI SDK (`@ai-sdk/anthropic`) handles streaming for Sonnet responses. OpenAI SDK handles embedding calls independently.

---

## Alternatives Considered

- **Single model (Claude Opus for everything):** Simplest architecture but expensive at scale. Embedding via Anthropic is not available; Opus for Q&A streaming is slower and costlier than necessary.
- **Open-source models (Ollama, Mistral, LLaMA):** Lowest cost, but requires GPU infrastructure. Vision quality for complex SA document types is significantly lower. Not viable for a product where extraction accuracy is the core value proposition.
- **Google Gemini:** Competitive vision capability, but introduces a third vendor SDK and Gemini Flash/Pro pricing models are less predictable. Ruled out to limit vendor surface area.
- **OpenAI for everything (GPT-4o + embeddings):** Viable, but Claude Opus outperforms GPT-4o on document extraction benchmarks for structured extraction tasks, especially handwritten and multi-column documents.

---

## Consequences

**Positive:**
- Best-fit model per task — accuracy maximised where it matters, cost minimised where it doesn't
- Claude Sonnet streaming delivers low-latency conversational UX
- OpenAI embeddings are industry-standard — broad ecosystem support, stable pricing

**Negative:**
- Two vendor dependencies (Anthropic + OpenAI) — both must be available for full functionality
- API key management for two providers
- Model version pinning required — model upgrades must be tested before rolling out

**Mitigations:**
- Embedding model is loosely coupled — embedding calls are isolated in a single module; swapping providers requires changing one function
- Sonnet Q&A can fall back to a cached response pattern if API is unavailable
- Model versions are pinned in environment config, not hardcoded in business logic
