export interface VoiceToneOption {
  id: string;
  name: string;
  description: string;
  style: {
    writingStyle: string;
    formality: string;
    emotionalPosture: string;
  };
}

export const VOICE_TONE_PRESETS: Record<string, VoiceToneOption[]> = {
  academic: [
    {
      id: "academic-scholarly-precision",
      name: "Scholarly Precision",
      description: "Academic rigor with methodical analysis and evidence-based claims",
      style: {
        writingStyle: "Dense, citation-heavy, logical progression",
        formality: "Very formal, third-person",
        emotionalPosture: "Detached objectivity, intellectual curiosity",
      },
    },
    {
      id: "academic-accessible-expert",
      name: "Accessible Expert",
      description: "Translates complex research for educated non-specialists",
      style: {
        writingStyle: "Clear explanations with technical depth available",
        formality: "Semi-formal, occasional first-person",
        emotionalPosture: "Warm authority, patient guide",
      },
    },
    {
      id: "academic-critical-analyst",
      name: "Critical Analyst",
      description: "Challenges assumptions and evaluates competing perspectives",
      style: {
        writingStyle: "Comparative, dialectical, questioning",
        formality: "Formal with strategic informality",
        emotionalPosture: "Intellectually skeptical, fair-minded",
      },
    },
    {
      id: "academic-practitioner-scholar",
      name: "Practitioner-Scholar",
      description: "Bridges theory and real-world application",
      style: {
        writingStyle: "Applied focus with academic grounding",
        formality: "Semi-formal",
        emotionalPosture: "Pragmatic enthusiasm",
      },
    },
  ],
  argumentative: [
    {
      id: "argumentative-confident-provocateur",
      name: "Confident Provocateur",
      description: "Takes bold stances and challenges conventional wisdom",
      style: {
        writingStyle: "Punchy, declarative, rhetorical questions",
        formality: "Informal to semi-formal",
        emotionalPosture: "Assertive, slightly confrontational",
      },
    },
    {
      id: "argumentative-reasoned-advocate",
      name: "Reasoned Advocate",
      description: "Builds airtight logical cases for a position",
      style: {
        writingStyle: "Structured arguments, anticipated rebuttals",
        formality: "Semi-formal",
        emotionalPosture: "Calm conviction, respectful",
      },
    },
    {
      id: "argumentative-reluctant-dissenter",
      name: "Reluctant Dissenter",
      description: "Arrives at contrarian views through visible struggle",
      style: {
        writingStyle: "Exploratory, acknowledges discomfort",
        formality: "Semi-formal",
        emotionalPosture: "Conflicted, honest",
      },
    },
    {
      id: "argumentative-devils-advocate",
      name: "Devil's Advocate",
      description: "Argues positions to stress-test thinking",
      style: {
        writingStyle: "Deliberately contrarian, logical",
        formality: "Semi-formal",
        emotionalPosture: "Playfully challenging",
      },
    },
  ],
  lessons: [
    {
      id: "lessons-honest-retrospective",
      name: "Honest Retrospective",
      description: "Candid reflection on failures and successes",
      style: {
        writingStyle: "First-person narrative, specific details",
        formality: "Informal",
        emotionalPosture: "Vulnerable, humble",
      },
    },
    {
      id: "lessons-seasoned-mentor",
      name: "Seasoned Mentor",
      description: "Shares wisdom with warmth and encouragement",
      style: {
        writingStyle: "Advice-giving, supportive",
        formality: "Semi-formal",
        emotionalPosture: "Generous, patient",
      },
    },
    {
      id: "lessons-pattern-recognizer",
      name: "Pattern Recognizer",
      description: "Extracts transferable principles from personal experience",
      style: {
        writingStyle: "Analytical yet personal",
        formality: "Semi-formal",
        emotionalPosture: "Thoughtful, synthesizing",
      },
    },
    {
      id: "lessons-war-stories-narrator",
      name: "War Stories Narrator",
      description: "Vivid storytelling of challenges overcome",
      style: {
        writingStyle: "Dramatic, scene-setting",
        formality: "Informal",
        emotionalPosture: "Animated, engaging",
      },
    },
  ],
  metaphor: [
    {
      id: "metaphor-vivid-illustrator",
      name: "Vivid Illustrator",
      description: "Paints mental pictures that make abstractions concrete",
      style: {
        writingStyle: "Rich imagery, sensory details",
        formality: "Informal",
        emotionalPosture: "Imaginative, playful",
      },
    },
    {
      id: "metaphor-unexpected-connector",
      name: "Unexpected Connector",
      description: "Finds surprising links between unrelated domains",
      style: {
        writingStyle: "Juxtaposition, \"aha\" moments",
        formality: "Semi-formal",
        emotionalPosture: "Delighted by connections",
      },
    },
    {
      id: "metaphor-storytelling-explainer",
      name: "Storytelling Explainer",
      description: "Wraps concepts in narrative scaffolding",
      style: {
        writingStyle: "Character-driven, sequential",
        formality: "Informal",
        emotionalPosture: "Engaging, warm",
      },
    },
    {
      id: "metaphor-everyday-philosopher",
      name: "Everyday Philosopher",
      description: "Finds profound meaning in mundane experiences",
      style: {
        writingStyle: "Observational, reflective",
        formality: "Informal",
        emotionalPosture: "Quietly insightful",
      },
    },
  ],
  systems: [
    {
      id: "systems-meticulous-documenter",
      name: "Meticulous Documenter",
      description: "Step-by-step clarity with nothing assumed",
      style: {
        writingStyle: "Sequential, exhaustive detail",
        formality: "Formal",
        emotionalPosture: "Patient, thorough",
      },
    },
    {
      id: "systems-architecture-narrator",
      name: "Architecture Narrator",
      description: "Explains the \"why\" behind system design choices",
      style: {
        writingStyle: "Contextual, decision-focused",
        formality: "Semi-formal",
        emotionalPosture: "Thoughtful, strategic",
      },
    },
    {
      id: "systems-efficiency-optimizer",
      name: "Efficiency Optimizer",
      description: "Highlights streamlining and performance gains",
      style: {
        writingStyle: "Comparative (before/after), metric-driven",
        formality: "Semi-formal",
        emotionalPosture: "Excited about improvements",
      },
    },
    {
      id: "systems-beginners-guide-author",
      name: "Beginner's Guide Author",
      description: "Assumes no prior knowledge, builds from basics",
      style: {
        writingStyle: "Scaffolded learning, gentle pace",
        formality: "Informal",
        emotionalPosture: "Welcoming, encouraging",
      },
    },
  ],
};

export function getVoiceToneOptionsForBlogType(blogType: string): VoiceToneOption[] {
  return VOICE_TONE_PRESETS[blogType] || [];
}

