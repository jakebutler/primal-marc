Hailuo Flash 2.3 generates exceptional videos when you think in terms of **motion and narrative change** rather than static visual description. Unlike image generation models, video generation requires you to specify what *changes* over time, how the camera moves, and what emotional tone drives the scene. This guide provides a structured framework for converting brief narratives into prompts that unlock Hailuo's full potential, specifically designed for web applications generating videos alongside blog posts, social content, and visual assets.

---

## Part 1: Foundational Concepts

### Why Hailuo Prompts are Different

**Image generation** (Midjourney, Stable Diffusion): Describe what you see in a frozen moment.

**Video generation** (Hailuo Flash 2.3): Describe what *changes*, the temporal progression, and narrative arc.

Hailuo excels at understanding cinematic intent. The model was trained on professional film data and responds exceptionally well to filmmaker language and structural thinking. Your role is to be a director communicating with an invisible camera operator and set choreographer.

### The Core Insight: Focus on "The Delta"

In Hailuo, the most powerful prompts describe only what *changes* in the scene. If your reference image shows a person standing on a cliff at sunset, you don't re-describe the cliff or the person's appearanceâ€”you describe the motion:

**Wrong**: "A red-haired woman in a blue jacket stands on a cliff overlooking the ocean at sunset with clouds in the sky."

**Right**: "Her hair and clothes blow dramatically in the strong wind as she gazes out at the sunset. The clouds move rapidly across the sky."

The delta approach prevents Hailuo from "hallucinating" elements that don't exist in the source material and keeps the character consistent throughout.

### The Balance: Specificity vs. Space for Interpretation

Hailuo performs best when you provide clear *direction* without being overly rigid:

- **Too vague**: "A person in a room" â†’ AI makes unpredictable guesses about mood, lighting, style
- **Too rigid**: "A person wearing a blue jacket with a 45-degree camera tilt using Kodak Portra 400 film stock" â†’ Model struggles to follow all constraints simultaneously
- **Optimal**: "A woman sits at a desk, contemplative. Warm afternoon light from the window illuminates her face. Camera slowly pushes in toward her eyes." â†’ Clear direction with interpretive flexibility

---

## Part 2: The Hailuo-Optimized Prompt Structure

### Recommended Format (Action-First Approach)

Hailuo responds best when you lead with action and cinematic instruction, not descriptive fluff:

```
[ACTION FIRST]
[CAMERA BEHAVIOR]
[ENVIRONMENT STABILITY]
[OPTIONAL: PACING/DURATION]
```

### Layer 1: Action Description (The Most Important)

Start with what's **happening** and the **emotional energy** driving it. This is 50% of your prompt's effectiveness.

**Structure**:
```
[Character/Subject] [verb - action] [adverb - how/speed] [emotional tone/motivation]
```

**Examples**:
- âœ“ "She turns her head slowly toward the camera, a mixture of sadness and resolve in her expression"
- âœ“ "The CEO walks purposefully through the glass corridor, glancing at documents, energy of focused determination"
- âœ“ "A hand gently opens an envelope, trembling slightly with anticipation"
- âœ— "A person is in the scene"
- âœ— "An executive moves forward"

**Key Principles**:
- Lead with strong verbs (turns, walks, reaches, unfolds, emerges)
- Specify *how* the action occurs (slowly, deliberately, frantically, gracefully)
- Include micro-expressions or emotional subtext
- If multiple actions occur, sequence them clearly: "First [action], then [action], then [action]"

### Layer 2: Camera Behavior & Framing

How the camera sees the action is critical to how Hailuo interprets motion and energy.

**Shot Type** (establishes visual intimacy):
- Wide shot / Establishing shot: Full environmental context
- Medium shot: From waist/chest up, traditional dialogue framing
- Close-up: Face or object detail
- Overhead / High angle: Dominance or insignificance
- Low angle: Grandeur or threat

**Camera Movement** (controls pacing and emotional weight):
- Static / Locked off: Stillness, observation, tension
- Slow push-in / Dolly in: Increasing emotional intensity, focus sharpening
- Slow pan: Revelation, exploration
- Tracking shot / Following: Active engagement with subject
- Zoom: Intensity change (use sparingly; push-in usually better)
- Whip pan / Quick cut: Urgency, surprise
- Circular / Orbiting: Mysterious, cinematic presentation

**Depth of Field** (controls where viewer attention goes):
- Shallow depth of field / Bokeh: Subject sharp, background blurred (intimate, emotional)
- Medium depth: Balanced
- Deep focus: Everything sharp (documentary, technical, clinical feel)

**Structure for this layer**:
```
[Shot type: wide/medium/close-up], [movement: slow push-in/pan/static/tracking], [depth: shallow/medium/deep depth of field]
```

**Examples**:
- âœ“ "Medium shot, slow push-in toward her face, shallow depth of field"
- âœ“ "Wide establishing shot, static camera, deep focus showing the full office environment"
- âœ“ "Close-up tracking shot, following the hand as it turns the page"

### Layer 3: Environment & Setting Stability

Describe the environment only to provide context and anchor consistency. Keep this minimal.

**What to include**:
- Location type (office, forest, kitchen, marketplace)
- Time of day (implied by lighting more than statement)
- Weather/atmosphere (rain, fog, clear)
- Overall aesthetic (modern, vintage, natural, industrial)

**What to avoid**:
- Overly detailed descriptions of every object
- Conflicting style cues ("cyberpunk medieval castle steampunk fantasy")
- Too many simultaneous transformations

**Key principle**: Use environmental description to *prevent* unwanted hallucination, not to over-specify.

**Examples**:
- âœ“ "Indoor studio setting with neutral lighting and simple background"
- âœ“ "A forest clearing at golden hour, with dappled sunlight through trees"
- âœ— "A hyper-detailed Victorian mansion with precisely placed 47 candles, detailed wallpaper in the background, antique furniture scattered everywhere..."

### Layer 4: Lighting & Atmosphere (Sets Emotional Tone)

Lighting is one of Hailuo's strengths and dramatically affects the emotional read of your video.

**Lighting direction**:
- Front light: Clarity, honesty, revealing
- Side light: Drama, intrigue, three-dimensionality
- Backlighting: Separation, ethereal quality, silhouette potential
- Overhead: Institutional, unforgiving
- Warm/Golden light: Comfort, nostalgia, intimacy
- Cool/Blue light: Isolation, technology, melancholy
- Natural/Window light: Authenticity, vulnerability
- Studio/Controlled: Precision, product focus, professionalism

**Atmospheric qualities**:
- Cinematic (professional film look)
- Warm glow / Golden hour
- High contrast / Dramatic
- Soft and diffused / Dreamy
- Moody / Atmospheric

**Structure**:
```
[Direction]-lit, [color temperature], [quality: soft/dramatic/warm/cool], [mood descriptor]
```

**Examples**:
- âœ“ "Warm, side-lit by golden afternoon light, cinematic and intimate"
- âœ“ "Cool blue light, high contrast, moody atmosphere of contemplation"
- âœ“ "Soft natural window light, gentle and authentic, warm undertones"

### Layer 5: Technical & Style Cues (Use Sparingly)

Hailuo is more robust than you might think, but excessive quality modifiers often backfire.

**What to avoid entirely** (causes "deepfry" effectâ€”oversaturation and artefacts):
- "Ultra-detailed"
- "8k, 4k, ultra-high resolution"
- "Masterpiece"
- "Award-winning"
- "Perfect lighting"
- "Cinematic masterpiece"

**What works**:
- Lens descriptions (35mm, 50mm, 85mmâ€”convey visual style and compression)
- Film stock references (Kodak Portra, Fujifilm, cinematic, gritty)
- Style anchors (1970s film, photorealistic, painterly, documentary)
- Aspect ratio if relevant (16:9, vertical for social)

**Structure**:
```
[Lens reference], [style/film stock], [aspect ratio if needed]
```

**Examples**:
- âœ“ "35mm lens, warm cinematic color grading"
- âœ“ "85mm, Fujifilm color palette, documentary realism"
- âœ“ "Shot on 16mm, slightly grainy, nostalgic tone"

### Layer 6: Duration & Pacing (Flow Control)

Specify the overall pacing and rhythm. This controls how Hailuo interpolates motion.

**Duration guidance**:
- 2-4 seconds: Single action, tight focus
- 4-8 seconds: Sequence of 2-3 actions or a more developed scene
- 8-12 seconds: Complex narrative, multiple beats, reveals

**Pacing descriptors**:
- Slow motion / Slow-mo: Dramatic emphasis
- Normal / Natural speed: Realistic timing
- Time-lapse / Accelerated: Show passage of time or build energy
- Rhythmic / Deliberate pacing: Control tempo of the action

**Structure**:
```
Duration: [seconds], pacing: [slow/normal/rhythmic/time-lapse]
```

---

## Part 3: Complete Prompt Template for Hailuo Flash 2.3

Use this structure as your baseline. Customize based on your specific needs.

```
[SCENE SETUP - Optional, 1-2 sentences max]
Brief context if needed to understand the scene.

[ACTION - Required, most important]
[Character/subject] [verb] [adverb] [emotional subtext]. 
Additional actions if needed: Then [next action], then [final action].

[CAMERA & FRAMING - Required]
[Shot type], [camera movement], [depth of field/focus description]

[LIGHTING & MOOD - Required]
[Light direction]-lit, [color temperature], [atmosphere/emotional quality]

[ENVIRONMENT - Optional]
[Setting description]. [Aesthetic/style anchor]

[OPTIONAL: PACING/TECHNICAL]
Duration: [seconds]. Pacing: [slow/normal/rhythmic]. 
[Lens or film stock reference if desired]
```

### Template Example - Product Video

```
A sleek, modern kitchen. Morning light is beginning to fill the room.

A hand reaches for a coffee mug on the counter with intentional, deliberate movements, 
conveying ritual and care. The hand lifts the mug slowly toward the camera, 
revealing its surface details.

Medium close-up, slow push-in on the mug as the hand raises it. Shallow depth of field 
with soft bokeh in the background.

Warm, side-lit by natural window light, golden hour quality. Soft, intimate, inviting.

Minimalist kitchen aesthetic, clean surfaces, natural materials. Photography: 85mm lens, 
warm film color.

Duration: 4 seconds. Pacing: Slow and deliberate.
```

### Template Example - Brand Story

```
An office building lobby during afternoon hours.

A professional walks through the glass doors with quiet confidence. She pauses, 
glancing at a document folder in her handâ€”a moment of determination mixed with 
focused concentration. She continues forward with purpose.

Wide establishing shot transitioning to medium shot with slow tracking. 
Camera follows her motion from left to right. Deep focus to show the environment and her intentionality.

Cool, professional lighting from overhead and side sources. Modern, clean, trustworthy.

Contemporary urban setting. Glass, steel, natural light. Professional, forward-thinking aesthetic.

Duration: 6 seconds. 35mm lens, cinematic color grading.
```

---

## Part 4: Integrating Brief-to-Prompt Workflow

When users provide a brief through your web app, follow this conversion process:

### Step 1: Extract Core Narrative from Brief

Your users provide a brief containing:
- Project objective
- Target audience
- Key messages
- Brand tone
- Deliverables (video, blog, social)

**Your job**: Convert this into a *single driving action or emotional arc*.

**Example brief snippet**:
```
Objective: Showcase new productivity tool launch
Key message: "Save time, reclaim focus"
Brand tone: Professional but human, modern, forward-thinking
Target audience: Busy executives and team leads
```

**Extract**:
```
Core action: Professional person transitions from overwhelmed/scattered state 
to focused/in-control state through tool interaction
```

### Step 2: Select Video Style Based on Brief

Different brief types require different approaches:

| Brief Type | Approach | Action Focus |
|---|---|---|
| Product Launch | Functionality reveal + emotion | Clean, deliberate movements; focus on interaction |
| Brand Story | Narrative arc | More complex sequences; emotional transitions |
| Educational | Process + clarity | Linear progression; demonstration of steps |
| Emotional/Testimonial | Authenticity | Subtle expressions; genuine emotion |
| Explainer | Clarity + visual metaphor | Clear, medium-paced; visual concepts |

### Step 3: Determine Visual Anchors

From the brief, identify:
- **Character/Subject**: Who appears? (Real person via reference image, or described?)
- **Setting**: Where does this occur?
- **Color palette**: What does the brand feel like? (Warm/cool? Saturated/minimal?)
- **Pacing**: Fast-paced and energetic? Slow and contemplative?

### Step 4: Build the Prompt

Using layers 1-6, construct the prompt:

1. **Action** (from brief's core narrative)
2. **Camera** (chosen based on video style)
3. **Lighting** (aligned with brand tone)
4. **Environment** (from brief's visual guidelines)
5. **Technical** (supports brand aesthetic)
6. **Duration** (based on message complexity)

### Example: Brief-to-Prompt Conversion

**Brief Input** (user provides):
```
Product: Cloud collaboration platform
Objective: Announce new real-time co-editing feature
Key message: "Teams move faster together"
Brand: Modern, inclusive, energetic but professional
Target audience: Mid-size tech companies
Visual style: Clean, bright, contemporary
Preferred setting: Tech office, modern team space
Duration needed: 6 seconds for social, 15-20 seconds for long-form
```

**Your conversion to Hailuo prompt**:
```
A modern tech office with glass walls and natural light pouring in.

Two professionals sit side-by-side at a desk, eyes on a screen. 
Subtle energy shifts as they realize they're editing the same document simultaneously. 
Both lean in with visible excitement and understanding. A moment of connection and shared purpose.

Medium wide shot, slow push-in as the moment of realization lands. Shallow depth of field 
to keep focus on their faces and the screen.

Bright natural window light, cool-warm balance (contemporary feel). 
Light, energetic, collaborative atmosphere. High key lighting suggesting innovation and possibility.

Minimalist tech office. Contemporary furnishings. Clean, white walls with glass surfaces.
Modern, inclusive aesthetic. Shot on 35mm, bright and clean color palette.

Duration: 6 seconds. Pacing: Natural, with a slight acceleration into the moment of realization.
```

---

## Part 5: Advanced Techniques & Optimization

### Subject Reference Model Integration

When your web app collects user information, offer the option to include a consistent character across videos.

**Best practices for subject reference**:
1. **Image requirements**:
   - Clear, well-lit photo of face (front-facing ideal)
   - 120x120 minimum resolution
   - File size under 20MB
   - No extreme shadows, filters, or obstructions
   - Simple background preferred

2. **Prompt structure with subject reference**:
   ```
   [Brief subject anchor - 2-3 words]
   
   [Then describe motion/action - what they do, not appearance]
   ```

3. **Example with subject reference**:
   ```
   The executive [brief anchor]
   
   Leans forward at her desk, eyes focused on the screen before her. 
   A moment of realization crosses her face. She straightens, resolved.
   
   Medium shot, slow push-in. Shallow depth of field.
   Warm side-lighting from desk lamp. Professional, focused, determined.
   Office setting. Clean desk, minimal clutter.
   
   Duration: 4 seconds.
   ```

**Critical principle**: Anchor the subject briefly, then focus entirely on describing their *actions and emotions*, not re-describing their appearance.

### Managing Multiple Scenes (Story-Based Videos)

For longer narrative videos, break the brief into distinct story beats:

1. **Establish** (wide, context-setting shot)
2. **Develop** (medium shots, character actions)
3. **Climax** (close-up emotional peak or key moment)
4. **Resolve** (return to medium/wide, conclusion)

Generate prompts for each beat sequentially:

**Beat 1 - Establish**:
```
Wide establishing shot of the office environment at morning. 
Soft light, quiet, contemplative mood.
Clean, modern aesthetic.
```

**Beat 2 - Introduce Challenge**:
```
A professional works at her desk, visible tension in her shoulders as she manages 
multiple windows and documents. Overwhelm and scattered focus.

Medium close-up, static camera watching her frustration build.
Cool, task-lighting. Slight tension in the atmosphere.
```

**Beat 3 - Solution Moment**:
```
The same professional pauses, then clicks open the new tool. 
Her face shiftsâ€”clarity, relief, purpose returning.

Close-up push-in on her eyes, then pulling back slightly. Shallow depth of field.
Warm, golden-tinted lighting as realization dawns.
```

**Beat 4 - Resolve**:
```
Now working with a colleague beside her in the same space, both engaged 
with the screen, collaborative energy flowing between them.

Medium wide shot, slightly elevated camera. Collaborative, connected mood.
Bright, inclusive lighting suggesting partnership.
```

### The 5-10-1 Iteration Strategy

For web app users generating videos, implement a smart iteration workflow:

1. **Phase 1 - Exploration (5 variations)**: Generate 5 quick versions of the prompt on Hailuo with slight variations
2. **Phase 2 - Refinement (10 iterations)**: Take the best result, refine the prompt, generate 10 more variations
3. **Phase 3 - Final (1 premium render)**: Use the optimized prompt for final rendering

This method saves generation credits while improving results dramatically.

**Prompt variations to test**:
- Adjust camera movement (static â†’ slow push-in)
- Change pacing (slow â†’ natural speed)
- Vary lighting temperature (warm â†’ cool â†’ balanced)
- Modify emotional subtext
- Adjust shot type (wide â†’ medium â†’ close-up)

---

## Part 6: Common Pitfalls & Solutions

### Problem 1: The Morphing Effect (Subjects Changing Shape/Appearance)

**Cause**: Too many conflicting instructions or subject changes mid-prompt.

**Solution**:
- Simplify action description to single, coherent motion
- Anchor subject clearly at prompt beginning
- Don't ask for multiple conflicting positions (e.g., "sitting down AND standing up AND running" in 6 seconds)

**Before**:
```
A woman with blonde hair sits at her desk reviewing documents, then stands up energetically, 
walks across the room, picks up a phone, and her expression transforms from sad to happy as she 
gets good news, then the lighting shifts dramatically from dark to bright.
```

**After**:
```
A woman sits at her desk, reviewing documents with focus. As she reads the message, 
her expression gradually shifts from concentration to quiet satisfaction.

Medium close-up, slow push-in. Shallow depth of field.
Warm side-lighting, professional atmosphere.
```

### Problem 2: The Deepfry Effect (Oversaturation, Artefacts)

**Cause**: Excessive quality modifiers and intensity language.

**Solution**:
- Remove "ultra-detailed, 8k, masterpiece, perfect, award-winning"
- Use natural descriptive language instead
- Let Hailuo's training handle quality; you focus on narrative

**Before**:
```
Ultra-detailed, 8k, masterpiece portrait of a determined warrior, 
perfect lighting, award-winning photography, ultra-high resolution, 
extremely cinematic with dramatic perfect color grading
```

**After**:
```
A weathered warrior gazes into the distance, resolve evident in their eyes. 
Warm sunset light illuminates the contours of their face, casting long shadows.

Close-up, slow pan from left to right. Deep focus.
Golden hour lighting, cinematic, documentary realism.
35mm lens, warm color palette.
```

### Problem 3: Generic/Bland Results

**Cause**: Vague prompts that let AI fill in all details, resulting in clichÃ©d footage.

**Solution**:
- Specify emotional subtext in actions
- Use directional language (slowly, deliberately, trembling, with purpose)
- Include sensory or emotional descriptors
- Anchor prompt with specific visual choices

**Before**:
```
A person in an office looks happy about something.
Wide shot, natural lighting, office setting.
```

**After**:
```
A professional sits at their desk, shoulders suddenly dropping as tension releases. 
A subtle smile spreads across their faceâ€”not theatrical, but genuine relief mixed with accomplishment.

Medium close-up, slow push-in on their face. Shallow depth of field.
Warm natural window light, soft and intimate, golden undertones.
Minimalist office, clean desk, contemporary aesthetic.
Duration: 4 seconds. Pacing: Slow, allowing the moment to breathe.
```

### Problem 4: Hallucination (AI Inventing Elements Not in Image)

**Cause**: Asking for shots/framing that don't match input image.

**Solution**:
- If input is close-up, request close-up actions only
- If input is wide establishing, keep similar framing
- Use subject reference to lock consistency

**Before** (input: close-up face):
```
She stands up, walks across the room, and opens a window overlooking the city.
```

**After** (input: close-up face):
```
Her eyes widen slightly as realization dawns. A tear forms at the corner of her eye.
She blinks slowly, processing the moment. A subtle exhale.

Close-up, extremely subtle camera movement, shallow depth of field.
Warm side-lighting, intimate and vulnerable.
```

### Problem 5: Inconsistent Character Across Multiple Scenes

**Cause**: Describing character appearance differently in each scene prompt.

**Solution**:
- Use subject reference image consistently
- In prompts, anchor with brief description once (e.g., "The executive in the blue jacket")
- Then focus only on actions in subsequent prompts
- Trust subject reference to handle appearance consistency

---

## Part 7: Platform-Specific Considerations

### For Social Media Videos (TikTok, Instagram Reels, YouTube Shorts)

**Specifications**:
- Duration: 4-8 seconds
- Aspect ratio: 9:16 (vertical) or 1:1 (square)
- Pacing: Fast-paced, energetic feel
- Focus: Single protagonist or clear focal point

**Prompt adjustments**:
```
[ACTION - with higher energy]
[CAMERA - more dynamic, slightly quicker movements]
[LIGHTING - bold, contrasting, eye-catching]
[DURATION - specify 6 seconds or less]
[PACING - energetic, rhythmic]
```

### For Long-Form Content (Blog, Website, YouTube)

**Specifications**:
- Duration: 15-30 seconds
- Aspect ratio: 16:9 (landscape)
- Pacing: More deliberate, narrative space to breathe
- Structure: Multiple beats/scenes

**Prompt adjustments**:
```
[More complex action with multiple beats]
[CAMERA - allows for establishing shots and development]
[LIGHTING - more nuanced, supporting emotional arc]
[DURATION - 15-30 seconds, allowing room for story beats]
[PACING - natural or slow, contemplative quality]
```

### For Product Showcase Videos

**Focus elements**:
- Product as character (if applicable)
- Details revealed gradually
- Interaction/functionality demonstrated
- Minimal distracting elements

**Prompt adjustments**:
```
[ACTION - focused on product interaction or revelation]
[CAMERA - push-in to reveal details, then pull back for context]
[LIGHTING - professional, highlighting product]
[ENVIRONMENT - minimal, clean, brand-aligned]
[DURATION - medium (8-12 seconds) for full showcase]
```

---

## Part 8: Implementation for Your Web App

### User Input Flow

1. **Brief Collection**:
   - Objective
   - Key message (1-2 sentences)
   - Tone/emotion desired
   - Duration needed
   - Setting preference
   - Character/talent (provide reference image or describe)

2. **Video Type Selection**:
   - Product launch
   - Brand story
   - Educational/explainer
   - Testimonial/authentic
   - Other

3. **Visual Preferences**:
   - Color tone (warm/cool/balanced)
   - Pacing (slow/natural/fast)
   - Style (cinematic/documentary/minimal/bold)

4. **Asset Planning**:
   - How will video complement blog post?
   - What social variations needed?
   - What visual assets will support the video?

### Prompt Generation Logic

Your app should:

1. **Extract** the core narrative action from the brief
2. **Map** to one of your prompt templates
3. **Fill in** layers 1-6 based on user selections
4. **Validate** for common pitfalls (too many simultaneous actions, excessive modifiers)
5. **Present** to user for review and refinement
6. **Offer** generation or iteration options

### Example Generated Prompt (from Brief Input)

**App receives**:
```
Objective: Showcase new AI feature
Key message: "Work smarter, not harder"
Tone: Professional yet approachable, innovative
Duration: 8 seconds (blog), 6 seconds (social)
Character: Sarah, VP of Operations (provide photo for subject reference)
Setting: Modern office
Style: Bright, clean, contemporary
Color: Cool-warm balanced (professional, not cold)
```

**App generates**:

```
A modern office space, glass walls, bright natural light, clean and contemporary.

Sarah, VP of Operations, sits at her desk reviewing a complex spreadsheet. 
Her initial expression shows the weight of the workâ€”focus mixed with burden. 
Then she clicks the new AI feature. Her entire demeanor shifts. 
Eyes brighten, shoulders relax. A moment of quiet relief and realization.

Starts with medium wide shot showing context, slow push-in as the 
moment of realization lands on her face. Medium depth of field.

Bright natural window light with warm undertones balanced by cool office lighting. 
Professional, approachable, innovative atmosphere. High-key lighting suggesting clarity.

Contemporary office aesthetic. Glass, natural wood, minimal clutter. 
Modern, forward-thinking. Shot on 35mm, balanced color palette, bright and clean.

Duration: 8 seconds (extend to 10 for blog context, trim to 6 for social). 
Pacing: Natural and measured, with slight acceleration into the realization moment.

Subject reference: Use provided image of Sarah.
```

---

## Part 9: Prompt Writing Checklist

Before submitting a prompt to Hailuo, verify:

- [ ] **Action is clear and specific** (not vague or generic)
- [ ] **Emotional subtext included** (not just mechanical movement)
- [ ] **Camera movement chosen intentionally** (serves the story)
- [ ] **Lighting direction supports mood** (emotional alignment)
- [ ] **Environment minimal but clear** (just enough context)
- [ ] **No conflicting style cues** (Baroque-cyberpunk-minimalist-maximalist)
- [ ] **No excessive quality modifiers** (ultra, masterpiece, 8k, perfect)
- [ ] **Word order is logical** (most important elements first)
- [ ] **If using subject reference**: Character only briefly anchored, then focus on actions
- [ ] **Duration/pacing specified** (clear expectations set)
- [ ] **Technically feasible** (shot choice matches image input if using image-to-video)
- [ ] **Tested in at least 1-2 variations** (5-10-1 rule applied)

---

## Part 10: Advanced Prompt Examples

### Example 1: Authentic Testimonial

**Brief**: Customer success story for SaaS product. Real person, emotional authenticity.

**Prompt**:
```
A comfortable home office setting, natural light from a nearby window, 
warm and authentic atmosphere.

A entrepreneur sits at their desk, initially looking thoughtfulâ€”almost uncertain. 
Then they're speaking (though no audio), hands gesturing with growing confidence. 
You see them transition from cautious to genuinely convinced, a smile forming 
that reaches their eyes. The moment feels honest, not performed.

Medium close-up, locked camera allowing full view of their face and gestures. 
Shallow depth of field, soft focus on background.

Warm, directional window light, soft and natural. Intimate, authentic, believable.

Home office with real elementsâ€”books, a plant, honest workspace. 
Not a studio, but genuine. Documentary realism aesthetic.

Duration: 8 seconds. Pacing: Natural speech rhythm.

Subject reference: [customer photo]
```

### Example 2: Product Feature Reveal

**Brief**: Showcase new dashboard interface. Technical but exciting.

**Prompt**:
```
A professional's hands at a keyboard and mouse in a modern office setting, 
screen visible in frame.

The user navigates to the new dashboard and clicks open. As the interface loads, 
their entire body language shifts subtlyâ€”shoulders drop, they lean in with interest. 
Hands move across keyboard with renewed purpose and fluidity. 
The action is deliberate but energetic.

Close-up on hands and screen, slow push-in as the interface becomes the focus. 
Medium depth of field showing hands and dashboard clearly.

Cool-white professional lighting, accent of blue glow from the screen. 
Technical, modern, but optimistic. Clean, precise atmosphere.

Contemporary office desk. Minimalist, clean surfaces. Modern technology aesthetic. 
Shot with 35mm lens equivalent, professional and precise.

Duration: 10 seconds. Pacing: Rhythmic, matching the pace of interaction.
```

### Example 3: Emotional Brand Moment

**Brief**: Brand values film. Show the human element of company culture.

**Prompt**:
```
An open office space, people working in background (blurred), focus on two 
individuals meeting by a window. Afternoon light.

Two team members approach each other. One carries work samples. 
There's a moment of genuine listeningâ€”the other person leans in, 
eyes focused, not distracted. Then agreement, a nod, and a quiet 
moment of connection. No exaggerated emotions, just real human collaboration.

Wide shot establishes context, then slow push-in to medium close-up 
capturing the moment of connection between them. Shallow depth of field 
isolating them from the blurred background.

Warm, side-lit by window light. Soft, diffused, human-scale lighting. 
Collaborative, genuine, respectful atmosphere.

Contemporary office, natural elements, open and inviting. 
Real workspace aesthetic. Shot on 50mm, warm color grade.

Duration: 8 seconds. Pacing: Slow and contemplative.
```

### Example 4: Educational/How-To Sequence

**Brief**: Explain multi-step process in 12 seconds. Clear and understandable.

**Prompt**:
```
A clean white desk, tools laid out before starting. Organized, educational feel.

Step 1: Hand picks up item A, positions it carefully.
Step 2: Hand applies tool B to item A with precise movements.
Step 3: Item A transforms subtly, revealing the result.
Step 4: Hand holds up the finished result to camera, clear and visible.

Each step has intentional clarity. Movements are medium-paced, 
deliberate, showing what matters. Smooth transitions between steps.

Wide-ish shot showing the full workspace, push-in slightly to emphasize key moments. 
Medium depth of field keeping the desk in focus.

Even, bright, slightly cool white lighting. High-key, technical, educational clarity. 
No shadows or ambiguity.

Clean desk, white or neutral background, organized tool layout. 
Educational, instructional aesthetic. Clean and clear. 
Natural daylight or studio equivalent.

Duration: 12 seconds. Pacing: Medium-paced, rhythmic. Each step gets roughly 3 seconds.
```

---

## Conclusion: From Brief to Screen

The most effective Hailuo prompts follow a clear hierarchy:

1. **Action and emotion** (50% importance)
2. **Camera and framing** (25% importance)
3. **Lighting and mood** (15% importance)
4. **Everything else** (10% importance)

For your web app, guide users to think like directors, not descriptiists. A brief becomes powerful when it's converted into a narrative action, anchored by clear visual choices, and brought to life by what the viewer *feels* watching it.

The best video generation prompts don't ask the model to be creativeâ€”they direct creativity toward a specific emotional and narrative goal. Every word serves the action. Every technical choice supports the mood. Every decision points toward one coherent message.

Use these frameworks to transform user briefs into prompts that unlock Hailuo Flash 2.3's full cinematic potential.