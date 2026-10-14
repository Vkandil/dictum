#!/usr/bin/env bash
# Rebuild public/mix.wav (and public/mix_nomusic.wav) from public/vo.mp3.
# Needs ffmpeg and Python with numpy, scipy and soundfile.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
ffmpeg -loglevel error -y -i public/vo.mp3 -ar 48000 -ac 1 "$tmp/vo48.wav"
python3 audio/mix.py "$tmp/vo48.wav" "$tmp/mix_raw.wav"
python3 audio/mix.py "$tmp/vo48.wav" "$tmp/mix_nomusic_raw.wav" --no-music

# Two-pass loudness normalisation to -14 LUFS / -1 dBTP (what X and other feeds expect).
master() {
  local in=$1 out=$2 m
  m=$(ffmpeg -hide_banner -i "$in" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
  read -r i tp lra th off < <(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print(d["input_i"],d["input_tp"],d["input_lra"],d["input_thresh"],d["target_offset"])' <<<"$m")
  ffmpeg -loglevel error -y -i "$in" -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$i:measured_TP=$tp:measured_LRA=$lra:measured_thresh=$th:offset=$off:linear=true" -ar 48000 "$out"
}
master "$tmp/mix_raw.wav" public/mix.wav
master "$tmp/mix_nomusic_raw.wav" public/mix_nomusic.wav
echo "wrote public/mix.wav and public/mix_nomusic.wav"
