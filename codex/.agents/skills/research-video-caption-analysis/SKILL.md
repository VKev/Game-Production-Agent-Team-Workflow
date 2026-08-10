---
name: research-video-caption-analysis
description: Analyze YouTube tutorials and other videos with caption-first, selectively frame-assisted evidence and no Whisper, GPU, or external transcription fallback. Use when asked to summarize, inspect, or extract implementation guidance from a video URL or local video; for YouTube, require uploaded or auto-generated captions, use frames only when the question or caption leaves a visual fact unresolved, and tell the user then stop when captions are unavailable or cannot be verified.
---

# Caption-Gated Video Analysis

Use captions first, then retrieve the minimum visual evidence needed for claims that captions cannot establish. Do not call a frame tool merely because it is available, and do not answer a visual-dependent question from captions alone. Read [references/tool-safety.md](references/tool-safety.md) before the first MCP call in a task.

## Hard YouTube gate

For every individual YouTube URL, run this skill's gate before metadata, frame extraction, summarization, or analysis:

```text
node <this-skill>/scripts/youtube-caption-gate.mjs --url <youtube-url> --language <preferred-language> --download
```

Pass the language requested by the user. When none is specified, prefer the language used in the request. The script checks uploaded subtitles first, then auto-generated captions, and only downloads a VTT file after a usable caption track is proven to exist.

Interpret the result strictly:

- Exit `0`, `captionsAvailable: true`: read the returned `captionFile`, use it as the transcript, and remove only the returned temporary `captionDirectory` after reading.
- Exit `3`, `captionsAvailable: false`: tell the user that the video exposes no usable uploaded or auto-generated YouTube captions and that analysis stopped because Whisper/GPU transcription is disabled. Stop the video task immediately.
- Exit `4`, `probeStatus: "error"`: tell the user captions could not be verified, include the sanitized reason, and stop. Do not interpret a private, age-restricted, unavailable, or failed probe as “no captions.”

After either stop result, do not call any video MCP tool, do not download the video, do not extract frames, and do not infer its content from the title, thumbnail, description, comments, or unrelated sources.

## Analysis workflow after a successful gate

1. Read the VTT captions and identify the passages and timestamps relevant to the user's question.
2. Classify the evidence need before any MCP call:
   - `speech-sufficient`: the requested facts are explicitly stated in the captions and do not depend on what appears or changes on screen. Use zero frame calls.
   - `visual-dependent`: the user asks about appearance, layout, UI state, scene contents, demonstrated code/settings, gestures, animation, timing, before/after state, or another fact that must be seen. Captions such as “as you can see,” “this value,” “here,” or “it now looks like this” also leave a visual fact unresolved. Retrieve frames.
   - `mixed`: answer spoken facts from captions and retrieve frames only for the visual-dependent claims. Do not sample frames for the caption-supported claims.
3. For each visual-dependent claim, use the smallest safe MCP call and stop retrieving when the claim is supported:
   - `get_frame_at` for one known timestamp.
   - `get_frame_burst` for a short motion, animation, or rapidly changing interval.
   - `get_frames` only when relevant timestamps cannot be narrowed from captions or the user explicitly needs a broad visual overview across the video.
   - `get_metadata` only after the caption gate and only when metadata materially helps.
4. Correlate each retrieved frame with the relevant caption timestamp. Distinguish what the speaker says, what the frame shows, and what is your inference. Never claim to have visually verified a detail when no frame was retrieved for it.
5. Report caption type and language when it affects confidence. Auto-generated captions can mishear package, API, and symbol names; verify technical identifiers against official documentation or project code before relying on them.

If a required frame tool is unavailable or frame extraction fails, report that the visual-dependent portion could not be verified. Answer only the caption-supported portion, clearly scoped as such; never silently substitute a caption-only guess for missing visual evidence.

## Other video sources

- For a local file, direct video URL, or a non-YouTube platform, use only user-supplied transcript/sidecar text plus the safe metadata/frame tools. If no transcript is supplied, state that audio content will not be transcribed and limit work to the visual question the user actually asked.
- Use only absolute local paths explicitly placed in scope by the user. The MCP process can read any file accessible to it, so never broaden a local-file search.
- Do not send a local or direct video to a third-party analysis service.

## Forbidden fallbacks

- Never call `analyze_video`, `analyze_videos`, `get_transcript`, or `analyze_moment`.
- Never run `npx mcp-video-analyzer ... analyze` or install the upstream multi-client video skill.
- Never install or invoke Whisper, faster-whisper, whisper-ctranslate2, Hugging Face speech recognition, PyTorch, CUDA, OpenAI transcription, TwelveLabs, or another audio-to-text service.
- Never continue a YouTube analysis after captions are absent or unverifiable, even if frame tools are available.
- Never call all safe tools by default. Tool availability is not a checklist: use zero frame calls when captions suffice and only the minimum relevant frame call when visual evidence is required.
