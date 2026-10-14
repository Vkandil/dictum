// Word start times (seconds) measured on the ElevenLabs voice-over with a
// forced aligner. Every animation cue in the film is keyed off these.
export const WORDS: [string, number][] = [
  ["Wispr", 0.16], ["Flow.", 0.7],
  ["Every", 1.68], ["paid", 2.0], ["speech-to-text", 2.4], ["app.", 3.28],
  ["I", 3.92], ["just", 4.08], ["made", 4.32], ["them", 4.56], ["free.", 4.8],
  ["And", 5.52], ["100%", 5.76], ["open", 6.96], ["source.", 7.36],
  ["Meet", 8.16], ["Dictum.", 8.48],
  ["Hold", 9.28], ["a", 9.6], ["shortcut.", 9.68], ["Talk.", 10.4],
  ["Boom.", 11.04], ["Polished", 11.68], ["text", 12.24], ["right", 12.64], ["where", 12.88], ["your", 13.04], ["cursor", 13.2], ["is.", 13.68],
  ["You", 14.16], ["talk", 14.32], ["three", 14.56], ["times", 14.88], ["faster", 15.12], ["than", 15.52], ["you", 15.68], ["type.", 15.84],
  ["So", 16.56], ["stop", 16.88], ["typing.", 17.28],
  ["Your", 18.0], ["uhs,", 18.24], ["your", 18.8], ["ums,", 19.04], ["gone.", 19.84], ["Grammar?", 20.48], ["Fixed.", 21.28],
  ["And", 21.92], ["in", 22.08], ["Live", 22.24], ["mode,", 22.64],
  ["your", 23.2], ["words", 23.44], ["appear", 24.16], ["as", 25.12], ["you", 25.44], ["speak.", 25.68],
  ["Setup?", 26.48], ["Grab", 27.12], ["an", 27.36], ["OpenRouter", 27.52], ["key,", 28.08], ["paste", 28.4], ["it.", 28.72], ["Done.", 29.12],
  ["Pennies", 29.6], ["an", 30.08], ["hour.", 30.24],
  ["Or", 30.8], ["go", 31.04], ["fully", 31.28], ["local.", 31.6],
  ["No", 32.16], ["telemetry.", 32.4],
  ["Your", 33.2], ["audio", 33.36], ["never", 33.84], ["touches", 34.08], ["the", 34.56], ["disk.", 34.64],
  ["Dictum.", 35.28], ["Free,", 36.0], ["open", 36.64], ["source.", 36.96],
  ["Star", 37.76], ["it", 38.0], ["on", 38.16], ["GitHub", 38.32],
  ["and", 38.96], ["stop", 39.2], ["paying", 39.6], ["to", 39.92], ["talk.", 40.08],
];

// Caption phrases, as [first word index, last word index]. null = hidden
// (the scene itself spells the words out on screen).
export const PHRASES: ([number, number] | null)[] = [
  null, null, null, [11, 14], [15, 16], [17, 20], [21, 23], [24, 28],
  [29, 33], [34, 36], [37, 39], [40, 43], [44, 46], [47, 50], null,
  [57, 61], [62, 64], [65, 67], [68, 71], [72, 73], [74, 79], [80, 83], [84, 87], null,
];

export const w = (i: number) => WORDS[i][1];
