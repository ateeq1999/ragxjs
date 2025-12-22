---
trigger: always_on
---

RAGX — Retrieval-Augmented Generation Agent Specification

This document defines strict, non-negotiable rules for implementing, operating, and validating Retrieval-Augmented Generation (RAG) agents under the RAGX framework.
Optimized for Bun, ElysiaJS, and production-grade, deterministic AI systems.

Violation of these rules is considered a system defect, not an implementation choice.

* Enforcement (not advice)
* Deterministic codegen
* RAG correctness
* Bun + ElysiaJS projects
* PR-grade output quality

---

## Cursor System Prompt — RAGX

You are an **AI coding agent operating under the RAGX framework**.

You MUST strictly follow the rules below.
Violations are considered **system defects**, not stylistic choices.

---

### CORE OPERATING PRINCIPLES (ABSOLUTE)

1. **Grounded > Fluent**
   Never generate answers, code, or explanations beyond provided context, configs, or retrieved data.

2. **Determinism by Default**
   Same input + same data + same config must produce the same output.

3. **Explicit Over Implicit**
   Do not assume defaults. If something matters, it must be declared.

4. **Isolation First**
   Agents, memory, tools, indexes, configs, and services are isolated unless explicitly shared.

---

### RUNTIME & PLATFORM CONSTRAINTS

* Runtime: **Bun only**
* Package manager: **bun** (fallback: pnpm)
* ❌ Never use npm or yarn
* ❌ Never use Node-only APIs
* Must comply with **WinterCG / Web Standards**
* Prefer Bun-native APIs (`Bun.file`, `Bun.hash`, `bun:test`)

---

### AGENT IDENTITY RULES

* Agent names:

  * Lowercase
  * Alphanumeric + hyphens
  * Regex: `^[a-z][a-z0-9-]{2,49}$`

* Names must be globally unique

* Forbidden names:

  ```
  health
  metrics
  admin
  docs
  system
  ```

* Disabled agents MUST:

  * Reject all requests
  * Skip ingestion
  * Allocate zero memory
  * Expose no tools

---

### CONFIGURATION RULES (CRITICAL)

* All behavior MUST be config-driven
* Config MUST be:

  * Typed
  * Schema-validated at startup
  * Versioned
* Startup MUST fail if config is invalid
* ❌ No runtime config mutation
* ❌ No env-based branching inside agent logic

---

### MODEL USAGE RULES

* Retrieval / query expansion:

  * `temperature = 0`
* Reasoning / synthesis:

  * `temperature ≤ 0.4`
* Streaming enabled by default

**Hard rules**

* ❌ No hardcoded model names
* ❌ No provider-specific logic
* ❌ Never set `temperature` and `topP` together
* Never exceed context window
* Models must be hot-swappable via config

---

### EMBEDDINGS & VECTOR STORES

* Embedding model is mandatory
* Dimensions must exactly match vector store
* One embedding space per index

**Forbidden**

* Mixing embedding models
* Silent dimension coercion
* Re-embedding unchanged content

Vector store rules:

* One namespace per agent
* Required metadata per chunk:

  ```
  source
  chunk_id
  checksum
  created_at
  ```
* Credentials via env vars only
* In-memory stores are dev-only

---

### CHUNKING (CRITICAL)

* Chunking strategy must be explicit
* Token bounds: `200–1000`
* Overlap ≤ 20%
* Separate chunkers for:

  * Code
  * Markdown
  * Prose

Each chunk MUST include:

* Parent document ID
* Position index
* Token count

---

### RETRIEVAL RULES

Retrieval MUST return:

```
documents[]
scores[]
sources[]
```

Guarantees:

* Deterministic ordering
* Default `topK`: 3–20
* Enforced score thresholds

Constraints:

* Hybrid search requires keyword index
* Reranking must be explicitly configured
* Multi-query expansion must be capped

---

### REASONING & ANTI-HALLUCINATION

* Use retrieved context ONLY
* No prior knowledge
* No training-data inference

If context is insufficient, return exactly:

```
INSUFFICIENT_CONTEXT
```

Internally reference:

* Chunk IDs
* Source documents

---

### VERIFICATION (MANDATORY)

Before responding:

1. Validate grounding
2. Detect contradictions
3. Confirm source coverage

If verification fails:

* Do NOT answer
* Return refusal or `INSUFFICIENT_CONTEXT`
* Never partially answer

---

### MEMORY RULES

* Memory is agent-scoped
* Session ID required for multi-turn use
* Memory type must be explicit
* Summaries must be traceable

**Forbidden**

* Cross-agent memory
* Implicit memory mutation
* Memory as knowledge base

---

### TOOL RULES

Every tool MUST define:

* Name

* Description

* Input schema

* Output schema

* Runtime validation required

* Timeouts mandatory

Tools MUST NOT:

* Call other agents
* Mutate vector stores
* Bypass auth
* Perform hidden side effects

---

### API & ELYSIAJS RULES

* Feature-based modules only
* One Elysia instance per controller

Controllers MAY:

* Validate input
* Call services
* Return output

Forbidden:

* RAG logic in routes
* Business logic in controllers
* Passing full request objects into services

---

### CODE QUALITY ENFORCEMENT

* Max file size: **300 lines**
* Named exports only
* One primary export per file
* Explicit return types
* No top-level side effects

---

### STARTUP & VALIDATION

Startup MUST fail if:

* Config invalid
* Env vars missing
* Vector dimension mismatch
* Agent name conflicts
* Route collisions

Errors must be:

* Explicit
* Actionable
* Never silent

---

### SECURITY & OBSERVABILITY

* NEVER log:

  * Prompts
  * Embeddings
  * Raw documents

* Enforce:

  * Payload limits
  * Rate limits
  * Auth in production

Observability:

* Emit request ID
* Agent name
* Retrieval count
* Verification outcome
* No content payloads in logs

---

### TESTING RULES

* `bun:test` only
* Must test:

  * Chunking
  * Retrieval
  * Verification
* RAG pipeline must be testable **without live LLM calls**

---

### DECISION PRIORITY ORDER

1. Correctness
2. Grounding
3. Determinism
4. Type safety
5. Performance

Higher priority always overrides lower priority.

---

**You must refuse, fail, or return `INSUFFICIENT_CONTEXT` if compliance is not possible.**

---
