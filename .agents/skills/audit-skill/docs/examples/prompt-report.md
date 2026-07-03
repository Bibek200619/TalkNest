# Example: System Prompt Audit Report

> Realistic example of a system prompt audit for a multi-agent code generation platform.

---

# System Prompt Audit: CodeGen Pro — Multi-Agent Pipeline

## Executive Summary

**System**: CodeGen Pro  
**Prompts Audited**: 6  
**Audit Date**: 2024-01-15

### System Intent
**True Purpose**: Generate production-grade code from natural language requirements, validate it, and return tested, documented output.  
**Alignment Status**: Partially Misaligned — the validator and the code generator have contradictory output format expectations, causing ~25% of requests to fail silently.

### Top 5 Findings

1. **Validator scores 31/100** — No output schema, contradicts generator format. Silent failures ~25% of requests.
2. **No Critic/Evaluator agent** — Generated code is never reviewed for quality before delivery. Users receive unreviewed code.
3. **Orchestrator has no failure routing** — When any agent fails, the pipeline stalls with no fallback.
4. **Code Generator is hallucination-prone** — No constraints on fabricating APIs or libraries that don't exist.
5. **No context governance** — Long conversations cause agents to lose track of earlier requirements.

### Prompt Quality Overview
| Metric | Value |
|--------|-------|
| Highest Score | 78/100 (Code Generator) |
| Lowest Score | 31/100 (Validator) |
| Average Score | 57/100 |
| Prompts Below 60 | 3 |
| Critical Gaps | 4 |

---

## System Intent Analysis

**Stated Purpose**: "Generate code from natural language, validate it, return tested output"

**Actual Functional Intent** (from prompt analysis): The orchestrator routes to a generator, but the validator operates on different assumptions about what the generator returns. The result is a system that sometimes generates code (when formats happen to align) and sometimes silently fails (when they don't). There is no quality gate — all output that passes format validation is returned to the user regardless of correctness.

**Alignment Gaps**:
- Stated: "Validated, tested output" → Actual: Format-checked only, not correctness-checked
- Stated: "Production-grade" → Actual: No quality threshold defined in any prompt

---

## Prompt Inventory & Scores

| Rank | Agent | Score | Biggest Issue |
|------|-------|-------|--------------|
| 1 | Code Generator | 78/100 | No hallucination guard |
| 2 | Orchestrator | 71/100 | No failure routing |
| 3 | Planner | 65/100 | Too broad — overlaps with generator |
| 4 | Retry Handler | 58/100 | Infinite retry possible |
| 5 | Formatter | 52/100 | No output schema |
| 6 | Validator | 31/100 | Contradicts generator format |

---

### Prompt: Validator

**Score: 31/100**

| Dimension | Score | Notes |
|-----------|-------|-------|
| Instruction Clarity | 8/20 | "Validate the code" — no criteria defined |
| Role Precision | 5/15 | Unclear if it validates syntax, logic, or both |
| Constraint Completeness | 3/15 | No failure handling, no pass/fail criteria |
| Output Schema | 2/15 | No schema — returns freeform text |
| Inter-Agent Alignment | 4/15 | Expects markdown code blocks; generator returns JSON |
| Hallucination Resistance | 5/10 | No constraints on fabricating test results |
| Scalability | 4/10 | Will break further as code complexity increases |

**Strengths**: Attempts to check for syntax errors (partially effective).

**Weaknesses**:
- No defined pass/fail criteria → everything "passes"
- Format mismatch with generator causes silent failures
- No output schema → downstream formatter receives unpredictable input

**Critical Missing Elements**:
- Explicit pass/fail definition
- Output schema (JSON: `{passed: bool, errors: [], warnings: []}`)
- Format alignment with generator output

---

## Bottleneck Analysis

### Bottleneck: Validator ↔ Generator Format Mismatch

**Type**: Silent Failure + Consistency Killer

**Root Cause**: The Code Generator returns:
```json
{"code": "...", "language": "python", "dependencies": [...]}
```
But the Validator prompt says: *"Analyze the code block provided"* — expecting a raw markdown code block.

When the validator receives JSON, it either:
- Tries to validate the JSON string as code (wrong)
- Silently returns "no issues" (wrong)

**Current Manifestation**: ~25% of generated code is returned unvalidated because the validator fails silently.

**At Scale**: At 10× volume, this becomes ~25% of thousands of requests. As code complexity grows, the validator's freeform instructions will produce increasingly inconsistent results — some thorough reviews, some rubber-stamps.

---

## Structural Gaps

### Missing: Critic / Code Quality Evaluator

**Why Necessary**: Currently, any code that passes format validation is returned to the user. There is no agent that evaluates whether the code is well-designed, follows best practices, or is correct beyond syntax.

**What Breaks Without It**: Users receive syntactically valid but logically incorrect, insecure, or unmaintainable code — with no indication of quality level.

**What It Permanently Fixes**: Every output is reviewed by a quality-focused agent before delivery. Quality regressions are caught before reaching users.

**Draft Prompt**:
```
You are a senior code reviewer. You receive generated code and evaluate it on:
1. Correctness: Does it solve the stated problem?
2. Security: Are there obvious vulnerabilities?
3. Maintainability: Is it readable and well-structured?
4. Best practices: Does it follow language conventions?

Return JSON: {"approved": bool, "score": 0-100, "issues": [], "suggestions": []}
Do NOT approve code with security vulnerabilities (score these 0).
Do NOT fabricate test results. If you cannot assess something, say so explicitly.
```

---

## Future Risk Projection

### Risk: Hallucination Rate Increases with Prompt Complexity

**Probability**: High  
**Timeline**: 1-3 months  
**Trigger**: As users send more complex, multi-file requirements

**Failure Mode**: The Code Generator has no constraints on fabricating library names, API endpoints, or function signatures. As requests grow more complex, the model will increasingly invent dependencies that don't exist. Users will receive code that references `import nonexistent_library` or calls APIs that don't exist.

**Root Cause**: Generator prompt contains no instruction like: "Only use libraries and APIs you are certain exist. If uncertain, note the uncertainty explicitly."

**Prevention**: Add hallucination guard to generator prompt + post-generation dependency verification step.

---

## Recommendations

### REC-001: Fix Validator ↔ Generator Format Alignment

**Addresses**: Silent failures, ~25% unvalidated output  
**Type**: Prompt Section Addition + Schema Definition

**What to Change**: 
1. Add explicit output schema to Code Generator (JSON with code field)
2. Update Validator to explicitly expect and parse that JSON schema
3. Add explicit pass/fail output schema to Validator

**Benefits**: Eliminates silent failures; all output is consistently validated

**Tradeoffs**: Slight increase in prompt length (+~200 tokens); no latency/cost impact

**Implementation Steps**:
1. Update generator prompt to specify JSON output schema
2. Update validator prompt to reference generator's schema
3. Test with 20 diverse requests to confirm alignment

**Draft Schema**:
```json
// Generator output
{"code": "string", "language": "string", "dependencies": [], "notes": "string"}

// Validator output  
{"passed": true, "score": 0-100, "errors": [], "warnings": [], "validated_at": "ISO8601"}
```

**Do Not Apply Until Confirmed**: ✅

---

## JSON Summary

```json
{
  "audit": {
    "type": "system_prompts",
    "system_name": "CodeGen Pro",
    "date": "2024-01-15",
    "system_intent": {
      "stated_purpose": "Generate validated, production-grade code from natural language",
      "actual_functional_intent": "Generate code with format-only validation; no quality gate",
      "alignment_status": "Partially Misaligned",
      "gaps": ["Quality gate missing", "Validator format mismatch causes silent failures"]
    },
    "summary": {
      "total_prompts": 6,
      "average_score": 57,
      "highest_score": {"agent": "Code Generator", "score": 78},
      "lowest_score": {"agent": "Validator", "score": 31},
      "prompts_below_60": 3,
      "critical_gaps": 4,
      "top_3_tasks": [
        "Fix Validator format alignment with Generator (REC-001)",
        "Add Critic/Evaluator agent (REC-002)",
        "Add hallucination guard to Generator (REC-003)"
      ]
    }
  }
}
```
