#!/usr/bin/env node

import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const EXIT_NO_CAPTIONS = 3;
const EXIT_PROBE_ERROR = 4;
const YTDLP = 'yt-dlp';

function usage() {
  return [
    'Usage:',
    '  node youtube-caption-gate.mjs --url <youtube-url> [--language <code>] [--download]',
    '',
    'Exit codes:',
    '  0  Usable uploaded or auto-generated VTT captions exist',
    '  3  No usable captions exist; stop video analysis',
    '  4  Captions could not be verified; stop video analysis',
  ].join('\n');
}

function parseArgs(argv) {
  const result = { url: undefined, language: undefined, download: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      result.help = true;
    } else if (argument === '--download') {
      result.download = true;
    } else if (argument === '--url' || argument === '--language') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${argument}`);
      }
      result[argument === '--url' ? 'url' : 'language'] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return result;
}

function isYouTubeUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return (
      hostname === 'youtu.be' ||
      hostname === 'youtube.com' ||
      hostname.endsWith('.youtube.com') ||
      hostname === 'youtube-nocookie.com' ||
      hostname.endsWith('.youtube-nocookie.com')
    );
  } catch {
    return false;
  }
}

function hasVttFormat(formats) {
  return Array.isArray(formats) && formats.some((format) => {
    return format && typeof format === 'object' && format.ext === 'vtt' && typeof format.url === 'string';
  });
}

export function collectCaptionTracks(metadata) {
  const collect = (source, kind) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
    return Object.entries(source)
      .filter(([language, formats]) => language.length > 0 && hasVttFormat(formats))
      .map(([language]) => ({ language, kind }));
  };

  return [
    ...collect(metadata?.subtitles, 'uploaded'),
    ...collect(metadata?.automatic_captions, 'automatic'),
  ];
}

function languageMatches(candidate, requested) {
  const left = candidate.toLowerCase();
  const right = requested.toLowerCase();
  return left === right || left.startsWith(`${right}-`) || right.startsWith(`${left}-`);
}

export function selectCaption(tracks, requestedLanguage) {
  const uploaded = tracks.filter((track) => track.kind === 'uploaded');
  const automatic = tracks.filter((track) => track.kind === 'automatic');
  const firstMatch = (items, language) => items.find((track) => languageMatches(track.language, language));

  if (requestedLanguage) {
    const requestedUploaded = firstMatch(uploaded, requestedLanguage);
    if (requestedUploaded) return requestedUploaded;
    const requestedAutomatic = firstMatch(automatic, requestedLanguage);
    if (requestedAutomatic) return requestedAutomatic;
  }

  const englishUploaded = firstMatch(uploaded, 'en');
  if (englishUploaded) return englishUploaded;
  const englishAutomatic = firstMatch(automatic, 'en');
  if (englishAutomatic) return englishAutomatic;

  return uploaded[0] || automatic[0] || null;
}

function runYtDlp(args, timeoutMs) {
  const result = spawnSync(YTDLP, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
  });

  if (result.error) {
    const reason = result.error.code === 'ENOENT' ? 'yt-dlp is not installed or not on PATH' : result.error.message;
    throw new Error(reason);
  }
  if (result.status !== 0) {
    throw new Error(`yt-dlp exited with code ${result.status}`);
  }
  return result.stdout;
}

function emit(payload, exitCode) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = exitCode;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n${usage()}\n`);
    process.exitCode = EXIT_PROBE_ERROR;
    return;
  }

  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!options.url || !isYouTubeUrl(options.url)) {
    emit({ probeStatus: 'error', captionsAvailable: false, reason: 'A single valid YouTube URL is required.' }, EXIT_PROBE_ERROR);
    return;
  }

  let metadata;
  try {
    const raw = runYtDlp(
      ['--dump-single-json', '--skip-download', '--no-playlist', '--no-warnings', '--', options.url],
      120_000,
    );
    metadata = JSON.parse(raw);
  } catch (error) {
    emit(
      {
        probeStatus: 'error',
        captionsAvailable: false,
        reason: `Caption availability could not be verified: ${error.message}`,
      },
      EXIT_PROBE_ERROR,
    );
    return;
  }

  const tracks = collectCaptionTracks(metadata);
  const selected = selectCaption(tracks, options.language);
  const common = {
    source: 'youtube',
    videoId: typeof metadata.id === 'string' ? metadata.id : undefined,
    title: typeof metadata.title === 'string' ? metadata.title : undefined,
    requestedLanguage: options.language,
    uploadedLanguageCount: tracks.filter((track) => track.kind === 'uploaded').length,
    automaticLanguageCount: tracks.filter((track) => track.kind === 'automatic').length,
  };

  if (!selected) {
    emit(
      {
        probeStatus: 'complete',
        captionsAvailable: false,
        reason: 'No uploaded or auto-generated VTT caption track is available.',
        ...common,
      },
      EXIT_NO_CAPTIONS,
    );
    return;
  }

  if (!options.download) {
    emit(
      {
        probeStatus: 'complete',
        captionsAvailable: true,
        captionKind: selected.kind,
        captionLanguage: selected.language,
        ...common,
      },
      0,
    );
    return;
  }

  const captionDirectory = mkdtempSync(join(tmpdir(), 'codex-youtube-captions-'));
  const safeId = String(metadata.id || 'video').replace(/[^A-Za-z0-9_-]/g, '_');
  const outputTemplate = join(captionDirectory, `caption-${safeId}.%(ext)s`);
  const captionFlag = selected.kind === 'uploaded' ? '--write-subs' : '--write-auto-subs';

  try {
    runYtDlp(
      [
        '--skip-download',
        '--no-playlist',
        '--no-warnings',
        captionFlag,
        '--sub-langs',
        selected.language,
        '--sub-format',
        'vtt',
        '--output',
        outputTemplate,
        '--',
        options.url,
      ],
      120_000,
    );

    const captionFiles = readdirSync(captionDirectory)
      .filter((name) => name.toLowerCase().endsWith('.vtt'))
      .map((name) => resolve(captionDirectory, name));
    if (captionFiles.length !== 1) {
      throw new Error(`Expected one VTT caption file but found ${captionFiles.length}`);
    }

    emit(
      {
        probeStatus: 'complete',
        captionsAvailable: true,
        captionKind: selected.kind,
        captionLanguage: selected.language,
        captionDirectory: resolve(captionDirectory),
        captionFile: captionFiles[0],
        captionFileName: basename(captionFiles[0]),
        ...common,
      },
      0,
    );
  } catch (error) {
    rmSync(captionDirectory, { recursive: true, force: true });
    emit(
      {
        probeStatus: 'error',
        captionsAvailable: false,
        reason: `Captions exist but the VTT file could not be downloaded: ${error.message}`,
        ...common,
      },
      EXIT_PROBE_ERROR,
    );
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  await main();
}
