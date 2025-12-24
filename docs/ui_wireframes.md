# UI Wireframes & Component Specifications

## Design System Reference

- **Colors:** Spicy Paprika (#e4572e), Tropical Teal (#17bebb), Bright Amber (#ffc914)
- **Components:** ShadCN UI + KokonutUI
- **Icons:** Lucide Icons
- **Typography:** Clean, modern font stack with generous spacing

## Layout Structure

### Main Layout

```
┌─────────────────────────────────────────────────┐
│ Header (Logo, User Menu, Settings)            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ Progress Indicator (Step 1 of 6)         │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ Main Content Area                        │  │
│  │                                           │  │
│  │ [Workflow Step Content]                  │  │
│  │                                           │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ Action Buttons (Approve, Request Changes) │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Step 1: Idea Submission

### Layout

```
┌─────────────────────────────────────────────────┐
│ Step 1: Share Your Idea                         │
├─────────────────────────────────────────────────┤
│                                                 │
│  What's your blog post idea?                    │
│  ┌─────────────────────────────────────────┐  │
│  │                                           │  │
│  │  [Large text area - 6-8 lines]           │  │
│  │                                           │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  Select blog type:                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│  │Academic│ │Argument│ │Lessons│ │Metaphor│ │Systems││
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘│
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │  [Start Writing] (Primary Button)       │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Component Specifications

- **Text Area:**
  - Placeholder: "Describe your blog post idea..."
  - Min height: 120px
  - Auto-resize
  - Border: 2px solid gray-200, focus: Tropical Teal

- **Blog Type Cards:**
  - Grid layout: 5 columns (responsive: 2-3 on mobile)
  - Card style with hover effect
  - Selected state: Spicy Paprika border
  - Icon + label per type

- **Submit Button:**
  - Full width
  - Spicy Paprika background
  - Large, prominent

---

## Step 2: Voice & Tone Selection

### Layout

```
┌─────────────────────────────────────────────────┐
│ Step 2: Choose Your Voice & Tone              │
├─────────────────────────────────────────────────┤
│                                                 │
│  Select the voice that best matches your brand: │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ ○ Professional & Authoritative            │  │
│  │   Clear, structured, instructional       │  │
│  │   Formality: High                         │  │
│  │   Tone: Confident, expert                │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ ○ Conversational & Engaging               │  │
│  │   Friendly, approachable, relatable      │  │
│  │   Formality: Medium                       │  │
│  │   Tone: Warm, inviting                   │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ ○ Reflective & Thoughtful                │  │
│  │   Honest, personal, insightful           │  │
│  │   Formality: Low-Medium                  │  │
│  │   Tone: Contemplative, authentic         │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Request      │  │ Approve & Continue   │  │
│  │ Changes      │  │ (Primary)             │  │
│  └──────────────┘  └────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Component Specifications

- **Voice Option Cards:**
  - Radio button selection
  - Card layout with padding
  - Hover: Light background tint
  - Selected: Tropical Teal border (2px)
  - Show all 3 options side-by-side (stacked on mobile)

- **Action Buttons:**
  - Secondary button: "Request Changes" (outline style)
  - Primary button: "Approve & Continue" (Spicy Paprika)

---

## Step 3: Thesis & Outline

### Layout

```
┌─────────────────────────────────────────────────┐
│ Step 3: Refine Your Thesis & Outline            │
├─────────────────────────────────────────────────┤
│                                                 │
│  Thesis Statement:                              │
│  ┌─────────────────────────────────────────┐  │
│  │ [Editable text - current thesis]        │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  Outline Structure:                              │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ 1. Introduction                          │  │
│  │    Purpose: Set context and hook        │  │
│  │    Evidence: Personal experience         │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ 2. The Problem                            │  │
│  │    Purpose: Define the core issue        │  │
│  │    Evidence: Research, examples         │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ 3. The Solution                          │  │
│  │    Purpose: Present approach             │  │
│  │    Evidence: Case studies, data         │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ 4. Conclusion                            │  │
│  │    Purpose: Reinforce key points        │  │
│  │    Evidence: Synthesis                  │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Request      │  │ Approve & Continue   │  │
│  │ Changes      │  │ (Primary)             │  │
│  └──────────────┘  └────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Component Specifications

- **Thesis Input:**
  - Editable text area
  - Border on focus
  - Character count indicator (optional)

- **Outline Cards:**
  - Numbered sections
  - Expandable/collapsible details
  - Visual hierarchy with indentation

---

## Step 4: Research Review

### Layout

```
┌─────────────────────────────────────────────────┐
│ Step 4: Review Research Sources                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  Found 8 sources for your blog post:            │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ ⭐⭐⭐⭐⭐ (5/5)                           │  │
│  │ "Context Engineering in AI Systems"      │  │
│  │ https://example.com/article              │  │
│  │ Supports: Section 2, Section 3           │  │
│  │ [Open Link]                               │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ ⭐⭐⭐⭐ (4/5)                             │  │
│  │ "Best Practices for Multimodal AI"        │  │
│  │ https://example.com/guide                 │  │
│  │ Supports: Section 3                       │  │
│  │ [Open Link]                               │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  [Show more sources...]                         │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ [Request Additional Research]            │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ [Approve & Continue] (Primary)           │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Component Specifications

- **Source Cards:**
  - Star rating display (1-5)
  - Title as link
  - URL display
  - Section mapping badges
  - Quality score rationale on hover/expand

- **Section Mapping Visualization:**
  - Badge chips showing section numbers
  - Color-coded by section

---

## Step 5: Draft Review

### Layout

```
┌─────────────────────────────────────────────────┐
│ Step 5: Review Your Draft                       │
├─────────────────────────────────────────────────┤
│                                                 │
│  Word Count: 1,247 words                        │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ [Scrollable Draft Content]               │  │
│  │                                           │  │
│  │ # Blog Title                              │  │
│  │                                           │  │
│  │ Introduction paragraph...                │  │
│  │                                           │  │
│  │ ## Section 1                              │  │
│  │ Content with citations [1]...             │  │
│  │                                           │  │
│  │ [Full blog content displayed]             │  │
│  │                                           │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ [Request Changes]                        │  │
│  │   Go back to: [Dropdown: Select Step]    │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ [Approve & Continue] (Primary)           │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Component Specifications

- **Draft Display:**
  - Markdown rendering
  - Syntax highlighting for code blocks
  - Citation links highlighted
  - Scrollable container (max height: 600px)

- **Request Changes:**
  - Dropdown to select which step to return to
  - Text area for change requests (optional)

---

## Step 6: Final Review & Export

### Layout

```
┌─────────────────────────────────────────────────┐
│ Step 6: Final Review & Export                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  Final Blog Post:                                │
│  ┌─────────────────────────────────────────┐  │
│  │ [Final edited content]                  │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  SEO Metadata:                                   │
│  ┌─────────────────────────────────────────┐  │
│  │ Title: [Editable]                       │  │
│  │ Meta Description: [Editable]            │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  Social Posts:                                   │
│  ┌─────────────────────────────────────────┐  │
│  │ Twitter/X:                              │  │
│  │ [Preview of tweet]                      │  │
│  │ [Copy]                                  │  │
│  └─────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────┐  │
│  │ LinkedIn:                               │  │
│  │ [Preview of post]                      │  │
│  │ [Copy]                                  │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ [Download Markdown] (Primary, Large)     │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Component Specifications

- **SEO Metadata:**
  - Editable text inputs
  - Character counters
  - Preview of how it will appear

- **Social Post Previews:**
  - Styled preview cards
  - Copy button for each
  - Character count indicators

- **Download Button:**
  - Large, prominent
  - Spicy Paprika color
  - Download icon

---

## Progress Indicator Component

### Design

```
┌─────────────────────────────────────────────────┐
│ ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 1    2    3    4    5    6                       │
│ Idea Voice Thesis Research Draft Final          │
└─────────────────────────────────────────────────┘
```

- Filled circles for completed steps
- Active step: Highlighted with Spicy Paprika
- Pending steps: Gray
- Clickable to navigate back (if step is completed)

---

## Error States

### Agent Failure

```
┌─────────────────────────────────────────────────┐
│ ⚠️ Agent Execution Failed                       │
├─────────────────────────────────────────────────┤
│                                                 │
│  The [Agent Name] encountered an error:          │
│  [Error message]                                │
│                                                 │
│  ┌──────────────┐  ┌────────────────────────┐  │
│  │ [Retry]      │  │ [Go Back]              │  │
│  └──────────────┘  └────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### API Key Missing

```
┌─────────────────────────────────────────────────┐
│ ⚠️ API Key Required                             │
├─────────────────────────────────────────────────┤
│                                                 │
│  Please configure your [Provider] API key       │
│  in Settings to continue.                       │  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ [Go to Settings]                         │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Loading States

### Agent Processing

```
┌─────────────────────────────────────────────────┐
│ Generating voice options...                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  [Animated spinner]                             │
│                                                 │
│  This may take 10-30 seconds...                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Mobile Responsive Considerations

- Stack cards vertically on mobile
- Full-width buttons
- Collapsible sections
- Touch-friendly tap targets (min 44px)
- Bottom sheet for actions on mobile

---

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support
- Focus indicators
- Screen reader announcements for state changes
- Color contrast ratios meet WCAG AA standards

