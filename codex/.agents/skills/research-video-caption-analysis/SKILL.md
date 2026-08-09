---
name: research-video-caption-analysis
description: Analyze YouTube tutorials and other videos without Whisper, GPU, or external transcription fallbacks. Use when asked to summarize, inspect, or extract implementation guidance from a video URL or local video; for YouTube, require uploaded or auto-generated captions and tell the user then stop when captions are unavailable or cannot be verified.
---

# Caption-Gated Video Analysis

Use captions as the textual evidence and the restricted video-analyzer MCP tools only for targeted visual evidence. Read [references/tool-safety.md](references/tool-safety.md) before the first MCP call in a task.

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
2. Answer from captions alone when the question is about spoken instructions and the transcript is sufficient.
3. When visual evidence is necessary, use the smallest safe MCP call:
   - `get_frame_at` for one known timestamp.
   - `get_frame_burst` for a short motion, animation, or rapidly changing interval.
   - `get_frames` only for a broad visual overview when targeted timestamps are insufficient.
   - `get_metadata` only after the caption gate and only when metadata materially helps.
4. Correlate caption timestamps with retrieved frames. Distinguish what the speaker says, what the frames show, and what is your inference.
5. Report caption type and language when it affects confidence. Auto-generated captions can mishear package, API, and symbol names; verify technical identifiers against official documentation or project code before relying on them.

## Other video sources

- For a local file, direct video URL, or a non-YouTube platform, use only user-supplied transcript/sidecar text plus the safe metadata/frame tools. If no transcript is supplied, state that audio content will not be transcribed and limit work to the visual question the user actually asked.
- Use only absolute local paths explicitly placed in scope by the user. The MCP process can read any file accessible to it, so never broaden a local-file search.
- Do not send a local or direct video to a third-party analysis service.

## Forbidden fallbacks

- Never call `analyze_video`, `analyze_videos`, `get_transcript`, or `analyze_moment`.
- Never run `npx mcp-video-analyzer ... analyze` or install the upstream multi-client video skill.
- Never install or invoke Whisper, faster-whisper, whisper-ctranslate2, Hugging Face speech recognition, PyTorch, CUDA, OpenAI transcription, TwelveLabs, or another audio-to-text service.
- Never continue a YouTube analysis after captions are absent or unverifiable, even if frame tools are available.
