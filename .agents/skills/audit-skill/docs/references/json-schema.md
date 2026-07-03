# JSON Output Schema

Machine-readable output schema for both audit types. Always include the full JSON at the end of every audit report.

---

## Codebase Audit JSON Schema

```json
{
  "audit": {
    "type": "codebase",
    "project": "string",
    "date": "ISO8601",
    "auditor": "Claude audit-skill",
    "summary": {
      "total_issues": 0,
      "critical": 0,
      "high": 0,
      "medium": 0,
      "low": 0,
      "top_3_tasks": ["task1", "task2", "task3"]
    },
    "findings": [
      {
        "id": "AUDIT-001",
        "severity": "Critical | High | Medium | Low",
        "category": "UI | Functional | Accessibility | Performance | Security | TestCoverage",
        "title": "string",
        "description": "string",
        "file": "path/to/file.ts",
        "line": 42,
        "reproduction_steps": ["Step 1", "Step 2"],
        "http_log": {
          "request": "POST /api/endpoint",
          "response": "500 {\"error\": \"message\"}"
        },
        "code_snippet": "string",
        "wcag_criteria": "1.4.3 (if accessibility issue)",
        "cve": "CVE-XXXX-XXXXX (if security issue)",
        "fix": {
          "description": "string",
          "diff": "string",
          "regression_test": "string"
        }
      }
    ],
    "ci_recommendations": ["string"],
    "sprint_plan": {
      "week_1": ["task1", "task2"],
      "week_2": ["task3", "task4"]
    }
  }
}
```

---

## System Prompt Audit JSON Schema

```json
{
  "audit": {
    "type": "system_prompts",
    "system_name": "string",
    "date": "ISO8601",
    "auditor": "Claude audit-skill",
    "system_intent": {
      "stated_purpose": "string",
      "actual_functional_intent": "string",
      "alignment_status": "Aligned | Partially Misaligned | Misaligned",
      "gaps": ["string"]
    },
    "prompt_inventory": [
      {
        "id": "PROMPT-001",
        "name": "string",
        "role": "string",
        "file": "string",
        "score": 0,
        "score_breakdown": {
          "instruction_clarity": 0,
          "role_precision": 0,
          "constraint_completeness": 0,
          "output_schema": 0,
          "inter_agent_alignment": 0,
          "hallucination_resistance": 0,
          "scalability": 0
        },
        "strengths": ["string"],
        "weaknesses": ["string"],
        "missing_elements": ["string"]
      }
    ],
    "ranking": [
      {"rank": 1, "agent": "string", "score": 0, "biggest_issue": "string"}
    ],
    "bottlenecks": [
      {
        "agent": "string",
        "type": "Quality Limiter | Consistency Killer | Silent Failure | Retry Loop | Scalability Block",
        "root_cause": "string",
        "current_manifestation": ["string"],
        "scale_degradation": ["string"]
      }
    ],
    "structural_gaps": [
      {
        "missing_role": "string",
        "why_necessary": "string",
        "breaks_without": "string",
        "fixes_with": "string",
        "draft_prompt": "string"
      }
    ],
    "future_risks": [
      {
        "title": "string",
        "probability": "High | Medium | Low",
        "timeline": "Immediate | 1-3 months | 3-6 months | 6+ months",
        "trigger": "string",
        "failure_mode": "string",
        "root_cause_prompt": "string",
        "cost_impact": "string",
        "prevention": "string"
      }
    ],
    "recommendations": [
      {
        "id": "REC-001",
        "title": "string",
        "addresses": "string",
        "type": "New Agent Role | New Prompt Section | Schema Addition | Governance Rule | Architecture Change",
        "description": "string",
        "benefits": ["string"],
        "tradeoffs": ["string"],
        "implementation_steps": ["string"],
        "draft_content": "string",
        "confirmed": false
      }
    ],
    "summary": {
      "total_prompts": 0,
      "average_score": 0,
      "highest_score": {"agent": "string", "score": 0},
      "lowest_score": {"agent": "string", "score": 0},
      "prompts_below_60": 0,
      "critical_gaps": 0,
      "top_3_tasks": ["task1", "task2", "task3"]
    }
  }
}
```
