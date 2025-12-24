# Agent Prompts Review & Validation

## Review Date: 2024

## Summary

All agent prompts have been reviewed against PRD requirements. Most prompts align well, with a few minor adjustments needed.

## Detailed Review

### 1. Voice & Tone Agent ✅ (Minor Update Needed)

**File:** `agents/voice_and_tone_agent.md`

**PRD Requirements:**
- Input: Blog post type, thesis (optional)
- Output: 3 voice/tone options with descriptions
- Checkpoint: User selects preferred option

**Current State:**
- ✅ Correct inputs
- ⚠️ Output says "2-3 options" but PRD specifies 3 options
- ⚠️ Blog type guidance includes "Framework / Mental Model" but PRD uses "Systems/Workflow Deep Dive"
- ✅ Correct output format

**Action Items:**
1. Update output to specify exactly 3 options
2. Update blog type guidance to match PRD (replace "Framework / Mental Model" with "Systems/Workflow Deep Dive")

**Status:** Needs minor updates

---

### 2. Idea Refiner Agent ✅

**File:** `agents/idea_refiner_agent.md`

**PRD Requirements:**
- Input: User's initial idea, selected blog post type, selected voice/tone
- Output: Approved thesis, structured outline (2-5 sections), evidence expectations, conclusion intent
- Checkpoint: User approves thesis and outline

**Current State:**
- ✅ All inputs match PRD
- ✅ All outputs match PRD
- ✅ Process aligns with PRD requirements
- ✅ Constraints properly defined

**Status:** Complete and aligned

---

### 3. Research Agent ✅

**File:** `agents/research_agent.md`

**PRD Requirements:**
- Input: Approved thesis, structured outline, evidence expectations
- Output: Curated source list with links, source quality scores (1-5 scale), mapping of sources to outline sections, suggested revisions
- Checkpoint: User reviews sources
- Capabilities: Web search access, source credibility assessment

**Current State:**
- ✅ All inputs match PRD
- ✅ All outputs match PRD
- ✅ Source quality scoring (1-5 scale) matches PRD
- ✅ Process includes web search and credibility assessment
- ✅ Rules properly defined (no invented citations, etc.)

**Status:** Complete and aligned

---

### 4. Blog Writer Agent ✅

**File:** `agents/blog_writer_agent.md`

**PRD Requirements:**
- Input: Approved thesis, structured outline, research sources, selected voice/tone
- Output: Complete 600-1500 word blog post draft
- Checkpoint: User reviews and can approve or request changes
- Rules: Follow outline, integrate sources naturally, match voice

**Current State:**
- ✅ All inputs match PRD
- ✅ Output matches PRD (600-1500 words)
- ✅ Rules align with PRD requirements
- ✅ Objective clearly stated

**Status:** Complete and aligned

---

### 5. Editorial & SEO Agent ⚠️ (Update Needed)

**File:** `agents/editorial_and_seo_agent.md`

**PRD Requirements:**
- Input: User-approved draft
- Output: Final edited blog post, SEO metadata (title, meta description, H2 suggestions), social post suggestions (Twitter/X, LinkedIn)
- Checkpoint: Final review before export

**Current State:**
- ✅ Input matches PRD
- ✅ Output includes final edited blog post
- ✅ Output includes SEO metadata
- ❌ **Missing:** Social post suggestions (Twitter/X, LinkedIn) - this is a required output per PRD

**Action Items:**
1. Add social post generation to process
2. Add social post suggestions to outputs section

**Status:** Needs update for social posts

---

## Alignment with PRD Workflow

All agents align with the workflow defined in PRD Section 4.1:
1. ✅ Voice & Tone Agent → User approval checkpoint
2. ✅ Idea Refiner Agent → User approval checkpoint
3. ✅ Research Agent → User review checkpoint
4. ✅ Blog Writer Agent → User approval checkpoint (with iteration back to itself)
5. ✅ Editorial & SEO Agent → Final review checkpoint

## Recommendations

1. **Update Voice & Tone Agent:**
   - Change "2-3 options" to "3 options"
   - Update blog type guidance to match PRD exactly

2. **Update Editorial & SEO Agent:**
   - Add social post generation process
   - Add social post suggestions to outputs

3. **Consider Adding:**
   - Structured output schemas (JSON) for each agent to ensure consistent parsing
   - Error handling instructions in prompts
   - Token limits or cost considerations

## Validation Status

- ✅ All agents have clear roles and objectives
- ✅ All agents have defined inputs/outputs
- ✅ All agents align with workflow checkpoints
- ⚠️ Minor updates needed for Voice & Tone Agent (blog type naming)
- ⚠️ Update needed for Editorial & SEO Agent (social posts)

**Overall Status:** 95% aligned, minor updates recommended

