
# Primal Marc — Multi‑Scene Video Generation System

This package documents the prompt architecture and workflow used to generate ~30s videos from
MiniMax's 10s video constraint by stitching multiple short clips.

## Workflow Overview
1. Idea Brief → structured editorial intent
2. Studio Cut → narrative framing
3. Character Image Generator → single reference character
4. Scene Script Generator → 4–6 independent scenes
5. Frame Image Prompt Generator → start/end frames per scene
6. Scene Video Prompt Composer → motion per scene
7. Deterministic assembly (ffmpeg) + optional audio

Each prompt lives in its own markdown file.
