# Dictum launch video

A 50-second, 1080×1350 (4:5), 60 fps motion-design launch film for X, built with [Remotion](https://www.remotion.dev/).
Every animation is keyed to the word timings of the ElevenLabs v4 voice-over (`public/vo.mp3`).

## Structure

| Time | Scene | File |
| --- | --- | --- |
| 0.0–4.4 s | Hook: Wispr Flow + a wall of 21 paid speech-to-text apps, struck out by a FREE stamp | `src/scenes/Hook.tsx` |
| 4.3–7.5 s | 100% open source counter, Download for Windows button | `src/scenes/OpenSource.tsx` |
| 7.4–8.7 s | The voice's waveform folds into the logo | `src/scenes/Meet.tsx` |
| 8.6–13.6 s | Shortcut keycaps, recording HUD, paste into chat / mail / code | `src/scenes/Shortcut.tsx` |
| 13.6–15.9 s | 3× faster than typing | `src/scenes/Speed.tsx` |
| 15.9–21.0 s | Fillers and hesitations explode, grammar fixes itself | `src/scenes/Cleanup.tsx` |
| 20.9–23.5 s | Live mode, words typed as they are spoken | `src/scenes/Live.tsx` |
| 23.5–28.0 s | Snippets: configure "my email", then watch it expand in a reply | `src/scenes/Snippets.tsx` |
| 28.0–31.3 s | Dictionary: misheard names and jargon corrected from your vocabulary | `src/scenes/Dictionary.tsx` |
| 31.3–36.1 s | History: every dictation, searched, stored only on your PC | `src/scenes/History.tsx` |
| 36.1–41.9 s | OpenRouter key → Dictum onboarding → price → local mode | `src/scenes/Setup.tsx` |
| 42.0–43.3 s | No telemetry | `src/scenes/Privacy.tsx` |
| 43.2–50.0 s | Logo, chips, GitHub star, call to action | `src/scenes/Outro.tsx` |

Some scenes were authored against the first voice-over take and carry a constant time shift
(`useTime() ± offset`, noted in each file's header) instead of being retimed by hand.

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
