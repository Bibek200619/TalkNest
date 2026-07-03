# System Prompt Audit Reference

Full instructions for performing a deep audit of AI system prompts across a multi-agent pipeline.

---

## Table of Contents
1. [Determine True System Intent](#1-determine-true-system-intent)
2. [Inventory All Prompts](#2-inventory-all-prompts)
3. [Individual Prompt Scoring](#3-individual-prompt-scoring)
4. [Bottleneck & Failure Analysis](#4-bottleneck--failure-analysis)
5. [Structural Gap Analysis](#5-structural-gap-analysis)
6. [Future Risk Projection](#6-future-risk-projection)
7. [Permanent Solutions](#7-permanent-solutions)
8. [Report Assembly](#8-report-assembly)

---

## 1. Determine True System Intent

**This is mandatory before any scoring or analysis.**

Before evaluating quality, explicitly determine and document:

### Questions to answer
1. **What is this system actually designed to do?** (not what it appears to do — what behavior do the prompts collectively produce?)
2. **What is the instruction hierarchy?** (which agent leads, which follow, how conflicts resolve)
3. **What are the real constraints?** (explicit rules vs. implied rules vs. missing rules)
4. **Are prompts aligned with the stated intent?** (gap between what owners think the system does vs. what it actually does)

### How to determine this
- Read all prompts in full before forming opinions
- Trace data flow: what does Agent A produce that Agent B consumes?
- Identify the "final arbiter" — which agent's output is the actual product?
- Look for contradictions between agents

### Output
```
## System Intent Analysis

**Stated Purpose**: [What the owner says it does]
**Actual Functional Intent**: [What the prompts actually produce]
**Alignment Status**: Aligned / Partially Misaligned / Misaligned
**Key Gaps Between Stated and Actual**: [List]
```

---

## 2. Inventory All Prompts

List every system prompt found, including:

| # | Agent Name | Role | Location/File | Lines | Has Output Schema? | Has Failure Handling? |
|---|-----------|------|--------------|-------|-------------------|----------------------|
| 1 | Orchestrator | Coordinates agents | prompts/orchestrator.md | 45 | No | Partial |
| 2 | Code Generator | Writes code | prompts/codegen.md | 120 | Yes | No |
| ... | | | | | | |

---

## 3. Individual Prompt Scoring

Score each prompt out of 100 using this rubric:

### Scoring Rubric

| Dimension | Weight | What to evaluate |
|-----------|--------|-----------------|
| Instruction Clarity | 20% | Are instructions unambiguous? Can a model follow them without interpretation? |
| Role Precision | 15% | Is the agent's role clearly bounded? Does it know what it should NOT do? |
| Constraint Completeness | 15% | Are edge cases handled? Are failure modes defined? |
| Output Schema Definition | 15% | Is the expected output format explicitly defined? |
| Inter-Agent Alignment | 15% | Does this prompt's output match what downstream agents expect? |
| Hallucination Resistance | 10% | Does the prompt constrain the model from fabricating data? |
| Scalability | 10% | Will this prompt hold up under increased complexity, volume, new agents? |

### Scoring Template (use for every prompt)

```markdown
### Prompt: [Agent Name]

**Score: XX/100**

| Dimension | Score | Notes |
|-----------|-------|-------|
| Instruction Clarity | X/20 | [why] |
| Role Precision | X/15 | [why] |
| Constraint Completeness | X/15 | [why] |
| Output Schema | X/15 | [why] |
| Inter-Agent Alignment | X/15 | [why] |
| Hallucination Resistance | X/10 | [why] |
| Scalability | X/10 | [why] |

**Strengths**:
- [What the prompt does well]

**Weaknesses**:
- [Specific flaws with evidence]

**Critical Missing Elements**:
- [What must be added]
```

### Summary Ranking Table

After scoring all prompts, produce:

```markdown
## Prompt Quality Ranking

| Rank | Agent | Score | Biggest Issue |
|------|-------|-------|--------------|
| 1 | [Best] | 87/100 | Minor output schema gaps |
| 2 | ... | | |
| N | [Worst] | 34/100 | No role definition, no constraints |
```

---

## 4. Bottleneck & Failure Analysis

**Goal**: Identify which prompts are degrading overall system quality right now.

### For each bottleneck, document

```markdown
### Bottleneck: [Agent Name / Interaction]

**Type**: Quality Limiter / Consistency Killer / Silent Failure / Retry Loop Trigger / Scalability Block

**Root Cause**:
[Specific design flaw in the prompt — not vague. E.g.: "The orchestrator has no output schema, 
so the validator receives differently-structured data on every run, causing 30% validation failures."]

**How It Manifests Today**:
- [Observable symptom 1]
- [Observable symptom 2]

**How It Worsens at Scale**:
- At 2× complexity: [specific degradation]
- At 10× volume: [specific degradation]
- With new agents added: [specific failure mode]

**Evidence From Prompts**:
> [Direct quote from the problematic prompt section]
```

### Common Bottleneck Patterns to Look For
- **No output schema** → downstream agents receive unpredictable input
- **Overly broad role** ("do whatever is needed") → model drifts, inconsistent behavior
- **No failure handling** → errors silently swallowed or cause infinite retries
- **Conflicting instructions between agents** → agents overwrite each other's work
- **Missing context handoff** → agents start each turn without needed context
- **No quality thresholds** → low-quality outputs pass unchecked

---

## 5. Structural Gap Analysis

**Goal**: Identify missing roles, reasoning stages, and governance mechanisms.

### Missing Agent Roles to Check For

| Role | Purpose | Missing If... |
|------|---------|--------------|
| Critic / Evaluator | Reviews outputs before passing downstream | No agent checks output quality |
| Reconciler | Resolves conflicts between agents | Two agents produce contradictory outputs |
| Context Manager | Maintains state across turns | Agents repeat work or lose context |
| Planner | Decomposes complex tasks before execution | Agents jump to execution without planning |
| Validator | Enforces schema/format on outputs | Outputs are inconsistently structured |
| Retry Handler | Manages failure and retry logic explicitly | Failures cause silent loops or crashes |
| Fallback Agent | Handles cases outside primary agent scope | Edge cases produce garbage or errors |

### For each gap, document

```markdown
### Missing: [Role Name]

**Why It's Necessary**:
[Specific problem it solves in this system]

**What Breaks Without It**:
[Concrete failure mode — specific, not generic]

**What Permanently Fixes With It**:
[The exact improvement in system behavior]

**Suggested Prompt (draft)**:
[Starter prompt for the missing agent]
```

### Missing Structural Elements
Also check for:
- [ ] No explicit prompt versioning/change control
- [ ] No context window governance (what gets truncated, what gets preserved)
- [ ] No cost/latency budgets per agent
- [ ] No explicit reasoning chain (chain-of-thought, reflection steps)
- [ ] No human-in-the-loop escalation paths
- [ ] No output confidence scoring

---

## 6. Future Risk Projection

**Goal**: Forecast concrete failures that will occur if nothing changes.

This is **predictive analysis**, not speculation. Base each risk on specific prompt design flaws identified above.

### Risk Template

```markdown
### Risk: [Title]

**Probability**: High / Medium / Low
**Timeline**: Immediate / 1-3 months / 3-6 months / 6+ months
**Trigger**: [What causes this to happen — specific condition]

**Failure Mode**:
[Exactly what breaks, what the user experiences, what the system produces]

**Root Cause (Prompt Level)**:
[Which specific prompt flaw causes this]

**Cost Impact** (if applicable):
[Retry loops → 3× API costs; quality failures → manual review overhead]

**Prevention**:
[What structural change prevents this — links to recommendations]
```

### Common Future Risks to Assess
- Quality degradation as prompt complexity increases
- Agent conflict when new agents are added without reconciliation
- Hallucination rate increase under novel inputs
- Retry/cost explosion from missing failure handling
- Context loss in long multi-turn conversations
- Maintenance failure as prompts become outdated

---

## 7. Permanent Solutions

**Goal**: Structural, permanent fixes only. No wording tweaks.

### Rules for Recommendations
- Every recommendation must address a **root cause**, not a symptom
- Must be **structural** (new agent role, new prompt section, new schema, new governance rule)
- Must hold under: increased complexity, new agents, new models, higher traffic
- Must clearly state **tradeoffs** (added latency, cost, complexity)

### Recommendation Template

```markdown
### Recommendation: [Title]

**Addresses**: [Which bottleneck/gap/risk]
**Type**: New Agent Role / New Prompt Section / Schema Addition / Governance Rule / Architecture Change

**What to Change**:
[Specific change — not vague. Include draft prompt or schema if applicable]

**Benefits**:
- [Specific improvement 1]
- [Specific improvement 2]

**Tradeoffs**:
- [Cost: e.g., +1 LLM call per turn = ~$X/1000 requests]
- [Latency: e.g., +500ms per request]
- [Complexity: e.g., adds 1 new agent to maintain]

**Implementation Steps**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Draft Prompt / Schema**:
```
[Starter content — mark as DRAFT, not final]
```

**Do Not Apply Until Confirmed**: ✅
```

---

## 8. Report Assembly

### Executive Summary Template

```markdown
## System Prompt Audit — Executive Summary

**System**: [Name]
**Prompts Audited**: [N]
**Audit Date**: [Date]

### System Intent
**True Purpose**: [One sentence]
**Alignment Status**: [Aligned / Misaligned + why]

### Top 5 Findings

1. **[Critical finding]** — [Agent] scores [X/100] — [Business impact]
2. ...

### Prompt Quality Overview
| Metric | Value |
|--------|-------|
| Highest Score | X/100 ([Agent]) |
| Lowest Score | X/100 ([Agent]) |
| Average Score | X/100 |
| Prompts Below 60 | N |
| Critical Gaps | N |

### Immediate Risks (Act Now)
1. [Risk] → [Fix]
2. ...

### Recommended Next 3 Engineering Tasks
1. [Task] — Priority: Critical — Estimated: [X days]
2. ...
```

### Change Control Checklist
Before applying any recommended changes:
- [ ] All recommendations reviewed and understood
- [ ] Tradeoffs accepted for each change
- [ ] Staging environment available for testing
- [ ] Rollback plan defined
- [ ] Explicit confirmation given for each change

**No prompt changes are applied without explicit confirmation.**
