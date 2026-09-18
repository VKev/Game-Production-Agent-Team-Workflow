# Tool safety and routing

The upstream server exposes eight tools. Under this project's no-transcription policy, Codex may expose and use only the four tools in the safe column. They are classified as safe only together with the setup skill's process-local `TWELVELABS_API_KEY = ""` override; without it, a direct video URL can select the TwelveLabs adapter even through metadata used by a frame tool.

| Tool | Policy | Reason |
|---|---|---|
| `get_metadata` | Allowed after the YouTube caption gate when materially needed | Metadata, comments, chapters, and available platform summary; no Whisper path. The empty TwelveLabs override prevents direct-URL remote analysis. |
| `get_frames` | Allowed only for an unresolved broad visual need | Frame extraction only. It can download a video and use CPU-based ffmpeg or a browser fallback; the empty TwelveLabs override prevents its metadata probe from selecting remote analysis for a direct URL. Do not call it when captions already answer the question or targeted timestamps are available. |
| `get_frame_at` | Preferred for one unresolved visual fact at a known timestamp | One visual frame at a requested timestamp; no transcript path. |
| `get_frame_burst` | Allowed for an unresolved short temporal change | Multiple frames over a short range; current source downloads/extracts frames and has no transcription path. |
| `get_transcript` | Forbidden | Empty native captions trigger video download, audio extraction, and Whisper fallback. |
| `analyze_video` | Forbidden | Full pipeline includes transcript and Whisper fallback. |
| `analyze_videos` | Forbidden | Batch wrapper around full analysis. |
| `analyze_moment` | Forbidden | Combines frames with transcript processing. |

Sources:

- [Upstream README and tool catalog](https://github.com/guimatheus92/mcp-video-analyzer)
- [Transcript fallback implementation](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/tools/get-transcript.ts)
- [Audio transcriber implementation](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/processors/audio-transcriber.ts)
- [Frame-burst implementation](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/tools/get-frame-burst.ts)
- [yt-dlp installation and subtitle support](https://github.com/yt-dlp/yt-dlp)

This classification is tied to current upstream behavior. If setup discovers a renamed or additional tool, leave it disabled until its implementation is reviewed.

Tool safety does not imply unconditional use. After a successful YouTube caption gate, classify the question first: use no frame tool for `speech-sufficient` work, the smallest targeted frame tool for `visual-dependent` work, and frames only for the visual portion of mixed work.
