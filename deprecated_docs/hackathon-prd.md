Primal Marc — Product Requirements Document (Hackathon Edition)

1. Product Overview

Product name: Primal Marc
Tagline: Thoughtful by default. Creative by design.

What it is:
Primal Marc is an AI-powered creative studio for builders and creators who want to think clearly and share deliberately. It transforms a rough idea into a structured creative brief, then generates aligned media assets — culminating in a cinematic short video (“Studio Cut”) that serves as the emotional exclamation point.

What it is not:
	•	A generic AI writing tool
	•	A content factory
	•	A marketing automation platform

This distinction should be evident in UX, copy, defaults, and output quality.

⸻

2. Target Persona

Primary persona: Founder / builder / creator

Characteristics:
	•	Thinks in systems and narratives
	•	Shares ideas publicly (blogs, social, talks)
	•	Values taste, coherence, and POV
	•	Time-constrained but quality-sensitive

Jobs to be done:
	•	Clarify a fuzzy idea
	•	Turn thinking into something shareable
	•	Produce high-quality visual storytelling without a full studio

⸻

3. Core Product Principles (Non-Negotiable)
	1.	Brief-first, always
All outputs derive from a single locked Idea Brief.
	2.	Opinionated defaults > configurability
Fewer knobs, stronger taste.
	3.	Emotional payoff matters
The cinematic video reveal is central to the experience.
	4.	Silence and space are features
UX should feel calm, intentional, and studio-like.
	5.	Show the thinking
The brief is visible and valued, not hidden.

⸻

4. v1 Scope (Hackathon Lock)

Included
	•	Account creation & authentication
	•	Idea intake (free text + optional wizard)
	•	Clarifying questions (single pass)
	•	Idea Brief generation (locked)
	•	Asset generation from brief:
	•	Blog post
	•	Social post(s)
	•	Visual assets (images)
	•	Cinematic short video (10–15s)
	•	Interstitial + cinematic reveal UX

Explicitly Excluded
	•	Iteration loops / re-prompts
	•	Collaborative editing
	•	Scheduling / publishing
	•	Fine-grained style tuning

⸻

5. User Flow (Happy Path)

5.1 Entry
	•	User lands on marketing page
	•	Clicks Create a Studio Cut
	•	Authenticates (email magic link or OAuth)

5.2 Idea Intake

User chooses one:
	•	Free-form idea input
	•	“Help me come up with an idea” wizard

System follows up with:
	•	3–5 clarifying questions
	•	Audience
	•	Literal vs metaphorical
	•	Desired tone (lightweight, serious, poetic, etc.)

5.3 Idea Brief Generation

System generates a read-only Idea Brief including:
	•	Core thesis
	•	Key arguments / beats
	•	Voice & tone descriptors
	•	Visual language
	•	Studio Cut concept (narrative + style)

CTA: Create Studio Cut

5.4 Generation Interstitial
	•	Brief fades
	•	Copy: “Turning a thought into a story”
	•	Subtle progress indicator
	•	Theater curtains animation
	•	B&W film countdown (5 → 1)

5.5 Reveal
	•	Video auto-plays
	•	Minimal UI
	•	Optional captions / narration

5.6 Asset Fan-out
	•	Blog post
	•	Social copy
	•	Visual assets

⸻

6. UX & Design Direction

Visual Language
	•	Editorial / creative studio
	•	Generous whitespace
	•	Serif headline + clean sans-serif body
	•	Muted palette with one accent color

Motion
	•	Slow, intentional transitions
	•	No spinners — use narrative interstitials
	•	Video reveal treated as a moment

Copy Tone
	•	Thoughtful
	•	Playful but restrained
	•	Never salesy

⸻

7. Technical Architecture (Proposed)

Frontend
	•	Framework: Next.js (App Router)
	•	Styling: Tailwind CSS
	•	Animation: Framer Motion
	•	Video playback: Native HTML5 + custom controls

Backend
	•	Runtime: Node.js / Edge where possible
	•	API layer: Next.js route handlers

Auth
	•	Abstracted auth layer (e.g., Auth.js / WorkOS / Clerk)
	•	Email-first (magic link)

Data
	•	Primary DB: Postgres (Neon or equivalent)
	•	Models:
	•	User
	•	Idea
	•	IdeaBrief
	•	Asset (typed by kind)

⸻

8. AI & Model Strategy

Text & Reasoning
	•	Provider: MiniMax
	•	Use cases:
	•	Idea expansion
	•	Clarifying questions
	•	Idea Brief generation
	•	Blog & social writing

Video Generation
	•	Provider: MiniMax / Hailuo 2.3 Fast
	•	Target length: 10–15 seconds
	•	Style: Cinematic, narrative, metaphor-friendly

Prompt Strategy (Key Insight)
	•	Video prompt is derived entirely from the Idea Brief
	•	Includes:
	•	Narrative arc
	•	Visual metaphors
	•	Color, pacing, mood
	•	Camera language

This prompt will be:
	•	Opinionated
	•	Versioned
	•	Exposed in submission materials

⸻

9. Studio Cut Prompt Composer Agent (New)

Purpose

The Prompt Composer Agent is a first-class system component responsible for translating a locked Idea Brief into a high-quality, cinematic video generation prompt optimized for MiniMax / Hailuo 2.3 Fast.

This agent does not perform simple template substitution. It exercises judgment, compression, and taste to compose a prompt whose structure and emphasis vary based on creative intent.

⸻

Why an Agent (Design Rationale)
	•	Video intent (literal vs metaphorical, cinematic vs editorial) fundamentally changes prompt grammar
	•	Hailuo output quality is sensitive to ordering, emphasis, and restraint
	•	Placeholder-based templates break under stylistic variance

Conclusion: Prompt composition must be interpretive, not mechanical.

⸻

Agent Inputs

Required (from Idea Brief):
	•	Core thesis
	•	Audience
	•	Voice & tone descriptors
	•	Narrative arc
	•	Visual language descriptors
	•	Studio Cut concept

Required (explicit intent resolution):
	•	Interpretation mode: literal | metaphorical
	•	Studio style: editorial | cinematic | documentary
	•	Emotional arc (single dominant arc)
	•	Pacing: slow | natural | rhythmic
	•	Duration: 10–15s (locked)

Optional (v1-safe):
	•	Captions: on | off
	•	Subtle narration: off | on

⸻

Internal Reasoning Steps (Non-Visible)

The agent performs the following steps internally:
	1.	Narrative Compression
Reduce the Idea Brief to a single visual transformation or action.
	2.	Emotional Prioritization
Select one primary emotion and one secondary supporting emotion.
	3.	Visual Metaphor Resolution
Choose one metaphor or literal representation that expresses the narrative delta.
	4.	Shot Grammar Selection
Decide camera distance, movement, and perspective appropriate to pacing and tone.
	5.	Restraint Pass
Remove competing imagery, excess description, text-heavy elements, and logos.

⸻

Output Contract

The agent outputs a single composed video prompt as plain text, structured but not templated.

The prompt must include:
	•	One dominant action or transformation
	•	Camera behavior (movement + framing)
	•	Lighting and mood
	•	Environmental constraints
	•	Explicit duration and pacing

The prompt must avoid:
	•	Multiple scenes
	•	Overly literal exposition
	•	UI, screens, logos, or text overlays (unless explicitly required)

⸻

Example Prompt Structure (Illustrative)

A solitary figure stands still as soft fog moves across the frame.
They take a single step forward, hesitation giving way to clarity.
As they move, the fog thins, revealing warm light and open space ahead.

Medium-wide shot with a slow push-in following the movement.
Shallow depth of field, background gradually resolving into focus.

Backlit by warm, diffused light breaking through the fog.
Cinematic, contemplative, restrained.

Minimal, abstract environment without defined objects.
Timeless, editorial aesthetic.

Duration: 12 seconds. Pacing: Slow and deliberate.
35mm lens feel, subtle film grain.


⸻

Guardrails

The Prompt Composer Agent must:
	•	Prefer simplicity over completeness
	•	Choose one clear visual idea
	•	Optimize for emotional clarity over spectacle

The agent must not:
	•	Generate multiple prompt variants (v1)
	•	Ask follow-up questions (v1)
	•	Attempt multi-beat narratives

⸻

Demo & Sponsor Value

This agent will be explicitly highlighted in the demo as:

“The system that turns a brief into a directed shot — not just a prompt.”

This showcases mature system design, intentional use of MiniMax video capabilities, and a clear path to future extensibility.

⸻

9. Performance & UX Constraints
	•	Video generation may take ~30–90s
	•	Interstitial must:
	•	Feel intentional
	•	Mask latency
	•	Build anticipation

If generation exceeds threshold:
	•	Show copy explaining the process
	•	Maintain cinematic tone

⸻

10. Landing Page Requirements

Goals
	•	Communicate POV in <10 seconds
	•	Prime judges for the demo
	•	Signal taste and restraint

Sections
	1.	Hero (tagline + CTA)
	2.	What it does (Idea → Brief → Studio Cut)
	3.	Studio Cut preview (GIF or still)
	4.	POV copy
	5.	Call to action

⸻

11. Hackathon Success Criteria
	•	Judges understand the idea without explanation
	•	Demo feels calm, confident, and intentional
	•	Sponsor technology is showcased naturally
	•	Audience remembers the video

⸻

12. Future Extensions (Out of Scope, Signaled)
	•	Iteration & remixing
	•	Multiple Studio Cut styles
	•	Collaborative studios
	•	Audio-first narratives
	•	Long-form video

⸻

13. Open Risks & Mitigations

Risk: Video quality variance
Mitigation: Known-good prompt + controlled demo input

Risk: Latency kills momentum
Mitigation: Strong interstitial design

Risk: Overbuilding
Mitigation: Ruthless scope discipline

⸻

14. Summary

Primal Marc is designed to win not by doing more, but by doing less — with taste, clarity, and emotional resonance. The brief is the product. The video is the payoff. Everything else supports that spine.