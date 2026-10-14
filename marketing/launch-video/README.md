# Dictum launch video

A 42-second, 1080×1350 (4:5), 60 fps motion-design launch film for X, built with [Remotion](https://www.remotion.dev/).
Every animation is keyed to the word timings of the ElevenLabs v4 voice-over (`public/vo.mp3`).

## Structure

| Time | Scene | File |
| --- | --- | --- |
| 0.0–5.5 s | Hook: subscription cards roll to $0, FREE stamp | `src/scenes/Hook.tsx` |
| 5.5–8.1 s | 100% open source counter over real `audio.rs` code | `src/scenes/OpenSource.tsx` |
| 8.0–9.3 s | The voice's waveform folds into the logo | `src/scenes/Meet.tsx` |
| 9.2–14.1 s | Shortcut keycaps, recording HUD, paste into chat / mail / code | `src/scenes/Shortcut.tsx` |
| 14.1–18.0 s | 3× faster than typing, keyboard falls apart | `src/scenes/Speed.tsx` |
| 18.0–21.9 s | Fillers explode, grammar fixes itself | `src/scenes/Cleanup.tsx` |
| 21.9–26.4 s | Live mode, words typed as they are spoken | `src/scenes/Live.tsx` |
| 26.4–32.0 s | OpenRouter key → Dictum onboarding → price → local mode | `src/scenes/Setup.tsx` |
| 32.0–35.3 s | No telemetry, audio never touches the disk | `src/scenes/Privacy.tsx` |
| 35.1–41.8 s | Logo, chips, GitHub star, call to action | `src/scenes/Outro.tsx` |

Shared pieces live in `src/components/`: the logo (bars measured from `logos/Dictum_png.png`), a faithful copy
of the recording HUD from `src/routes/Overlay.tsx`, keycaps, the Windows 11 window frame, captions and background.
Word timings are in `src/timeline.ts`; `src/envelope.json` is the voice loudness per frame that drives the waveforms.

## Sound

`audio/mix.py` synthesizes every sound effect and the music bed with numpy/scipy, so there are no third-party samples
to license. `npm run audio` rebuilds `public/mix.wav` and `public/mix_nomusic.wav` (voice + SFX only), mastered to
−14 LUFS / −1 dBTP.

## Commands

```bash
npm install
npm run audio          # needs ffmpeg + python3 with numpy, scipy, soundfile
npm run studio         # live preview
npm run render         # out/dictum-launch.mp4
npm run render:nomusic # out/dictum-launch-nomusic.mp4, to add your own track
npm run stills 0 4.9   # review PNGs at given seconds into out/stills/
```

To swap the voice-over, replace `public/vo.mp3`, update the word times in `src/timeline.ts`, regenerate
`src/envelope.json` with `python3 audio/envelope.py public/vo.mp3 src/envelope.json`, and run `npm run audio`.
