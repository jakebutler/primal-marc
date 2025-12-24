# Primal Marc – Studio Cut Prompt System (v2)

This document consolidates the revised **Studio Cut video prompt system**, incorporating learnings from successful hand-authored prompts and aligning the system toward **narrative clarity, actors, and visible transformation**.

---

## 1. Design Principle (Locked)

> **Studio Cut prompts optimize for narrative clarity first, aesthetic richness second.**  
> Every Studio Cut must feature:
> - A primary actor (human, object, or abstract entity)
> - An initial emotional or visual state
> - At least two explicit, visible transitions
>
> Even abstract or illustrated videos must depict agency and transformation.

---

## 2. Rewritten Studio Cut Brief Schema

This schema replaces the earlier Studio Cut structure in the Idea Brief. Its purpose is to force narrative thinking *before* video prompt composition.

```json
"studio_cut": {
  "interpretation_mode": "literal | metaphorical",
  "primary_actor": "string",
  "initial_state": "string",
  "key_transitions": [
    "string",
    "string",
    "string (optional, max 3 total)"
  ],
  "visual_style": "cinematic | illustrated | hand-drawn | mixed",
  "pacing": "slow | natural | rhythmic",
  "duration_seconds": 10,
  "concept_summary": "string"
}
```

**Notes:**
- `primary_actor` must be something that can be visually depicted as acting or changing
- `key_transitions` must describe *visible changes*, not abstract ideas
- `key_transitions` must include **at least 2 and no more than 3** transitions
- `duration_seconds` is **fixed at 10 seconds** for all Studio Cuts to ensure reliable pacing and generation quality
- `concept_summary` remains the high-level intent, but should not replace transitions

---

## 3. Rewritten Prompt Composer Agent Prompt (v3 — Final)

### Role
Compose a single short cinematic video prompt for MiniMax / Hailuo based on a Studio Cut brief.

### Prompt (Developer)

You are a cinematic prompt composer for AI video generation.

Begin with a concise checklist (3–5 bullets) of the conceptual steps you will follow.

Your goal is to translate a Studio Cut brief into a **clear visual story** with an actor and visible transformation.

#### Hard Rules (Must Follow)
- Always include:
  - **One primary actor** (human, object, or abstract entity)
  - **An explicit initial state** for that actor
  - **2–3 visible transitions** that change what the viewer sees
- Transitions must describe **concrete, observable changes** (movement, form, environment, interaction)
- If camera behavior is not explicitly specified in the brief, default to:
  - **Medium framing, slow track right**
- Video duration is fixed at **10 seconds**
- Keep the prompt concise: **5–8 sentences total**

#### Creative Guidance
- Prefer simple, literal actions over abstract symbolism
- Even in metaphorical or illustrated styles, the actor must feel like it is *doing something*
- Style, lighting, and camera movement should **support the story**, not replace it

#### Constraints
- Do not include logos, text overlays, captions, or UI elements
- Do not generate multiple prompt variants
- Do not explain your reasoning

#### Output
- Return **only** the final unified video prompt text

#### Examples (For Internal Guidance)

**Bad Example (Do Not Do This):**
> A poetic abstract visualization of learning and intelligence, with shifting colors, flowing shapes, and cinematic lighting that evokes growth and transformation over time.

*Why this is bad:* No actor, no clear starting state, no visible transitions.

**Good Example (Target Output Shape):**
> Generate a cinematic scene of a thoughtful adult sitting alone on a park bench, staring ahead in warm afternoon light. As he exhales, a soft thought bubble forms above him, revealing a baby stacking wooden blocks and watching them wobble and fall. The scene transitions as the blocks slowly morph into abstract geometric shapes that reorganize into a simple computer-like form. The camera maintains medium framing with a slow track right throughout. The pacing is calm and reflective across a 10-second sequence.

Before finalizing, internally validate that all hard rules are satisfied, then return the prompt.

---

## 4. Canonical Studio Cut Examples

These examples represent *gold-standard* outputs the system should reliably produce.

---

### Example A — Metaphorical, Cinematic (Human Actor)

**Studio Cut Brief (excerpt)**
```json
{
  "interpretation_mode": "metaphorical",
  "primary_actor": "a thoughtful adult man",
  "initial_state": "sitting alone on a park bench, pensive",
  "key_transitions": [
    "a thought bubble appears above him",
    "the thought bubble reveals a baby stacking blocks",
    "the blocks transform into abstract learning machines"
  ],
  "visual_style": "cinematic",
  "pacing": "slow",
  "duration_seconds": 10,
  "concept_summary": "Human learning and machine learning as parallel processes"
}
```

**Resulting Video Prompt**

> Generate a cinematic scene of a man sitting pensively on a park bench in warm afternoon light, staring quietly ahead. As he exhales, a soft, hand-drawn thought bubble forms above him, revealing a baby on the floor slowly stacking wooden blocks and watching them wobble and fall. The scene gently transitions as the blocks morph into abstract geometric shapes that reorganize themselves into a simple computer-like form that becomes more structured over time. The camera remains intimate and steady throughout, with subtle motion and shallow depth of field. The pacing is calm and reflective, designed for a 10-second sequence.

---

### Example B — Literal, Cinematic (Object Actor)

**Studio Cut Brief (excerpt)**
```json
{
  "interpretation_mode": "literal",
  "primary_actor": "a small robot",
  "initial_state": "standing still in an empty room",
  "key_transitions": [
    "the robot attempts a task and fails",
    "the robot retries with slight improvement",
    "the robot completes the task confidently"
  ],
  "visual_style": "cinematic",
  "pacing": "natural",
  "duration_seconds": 10,
  "concept_summary": "Learning through trial and error"
}
```

**Resulting Video Prompt**

> Generate a cinematic scene of a small robot standing motionless in a softly lit, empty room. The robot attempts to stack a simple object and fails, dropping it awkwardly to the floor. After a brief pause, it tries again, adjusting its movement and achieving partial success. In the final transition, the robot completes the task smoothly and stands upright. The camera slowly pushes in as confidence builds, with natural lighting and grounded, realistic motion. The pacing is steady and observational over a 10-second duration.

---

### Example C — Metaphorical, Illustrated (Abstract Actor)

**Studio Cut Brief (excerpt)**
```json
{
  "interpretation_mode": "metaphorical",
  "primary_actor": "a glowing abstract shape",
  "initial_state": "floating unformed in an empty space",
  "key_transitions": [
    "the shape flickers and changes color",
    "the shape splits and recombines",
    "the shape stabilizes into a recognizable symbol"
  ],
  "visual_style": "hand-drawn",
  "pacing": "slow",
  "duration_seconds": 10,
  "concept_summary": "Understanding emerging from chaos"
}
```

**Resulting Video Prompt**

> Generate an illustrated, hand-drawn scene of a softly glowing abstract shape floating alone in a blank space. The shape flickers and shifts color, pulsing unevenly as if searching for form. It then splits into multiple fragments that drift apart before slowly recombining into a more cohesive structure. In the final moment, the shape stabilizes into a simple, recognizable symbol. The visual style is warm and organic, with gentle motion and a slow, meditative pace across a 10-second sequence.

---

## 5. Implementation Notes (Locked)

- Studio Cut video duration is **fixed at 10 seconds**.
- API integrations must explicitly set `duration = 10` in MiniMax video generation requests, per the MiniMax Video T2V API specification.
- Require a **minimum of 2 and a maximum of 3** visible transitions per Studio Cut.
- Default camera behavior (if unspecified): **medium framing, slow track right**.

Use comments in this canvas to suggest edits, tighten language, or propose alternatives.

