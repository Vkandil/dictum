// Word start times (seconds) measured on the ElevenLabs voice-over with a
// forced aligner. Every animation cue in the film is keyed off these.
export const WORDS: [string, number][] = [
  ["I", 0.0], ["just", 0.32], ["made", 0.48], ["Wispr Flow,", 0.72],
  ["and", 1.76], ["every", 2.0], ["speech-to-text", 2.32], ["app", 3.2], ["free.", 3.68],
  ["100%", 4.4], ["open", 5.28], ["source", 5.6], ["so", 6.0], ["you", 6.16], ["can", 6.24], ["download", 6.4], ["it", 6.8], ["now.", 6.96],
  ["Meet", 7.52], ["Dictum.", 7.92],
  ["Hold", 8.72], ["a", 8.96], ["shortcut,", 9.04], ["talk.", 9.84],
  ["Boom!", 10.48], ["Polished", 11.12], ["text", 11.68], ["right", 12.16], ["where", 12.4], ["your", 12.56], ["cursor", 12.72], ["is.", 13.2],
  ["You", 13.68], ["talk", 13.84], ["three", 14.08], ["times", 14.4], ["faster", 14.72], ["than", 15.12], ["you", 15.28], ["type.", 15.36],
  ["Your", 15.92], ["uhs,", 16.16], ["your", 16.72], ["ums,", 16.88], ["and", 17.44], ["all", 17.6], ["hesitations,", 17.84], ["gone.", 18.88], ["Grammar?", 19.6], ["Fixed.", 20.32],
  ["Live", 20.88], ["mode?", 21.28], ["Your", 21.76], ["words", 21.92], ["appear", 22.32], ["as", 22.64], ["you", 22.8], ["speak.", 22.96],
  ["You", 23.6], ["can", 23.76], ["configure", 23.92], ["snippets.", 24.4], ["Say", 25.2], ["“my", 25.52], ["email”", 25.76], ["and", 26.32], ["your", 26.48], ["full", 26.64], ["address", 26.88], ["drops", 27.28], ["in.", 27.6],
  ["A", 28.0], ["dictionary", 28.16], ["that", 28.72], ["spells", 28.88], ["your", 29.28], ["names", 29.44], ["and", 29.84], ["your", 30.0], ["jargon", 30.16], ["right.", 30.8],
  ["And", 31.36], ["a", 31.6], ["History", 31.76], ["of", 32.24], ["everything", 32.56], ["you've", 32.8], ["said:", 33.12], ["searchable,", 33.6], ["and", 34.24], ["stored", 34.4], ["only", 34.8], ["on", 35.04], ["your", 35.2], ["PC.", 35.36],
  ["Setup?", 36.16], ["Grab", 36.8], ["an", 37.04], ["OpenRouter", 37.2], ["key,", 37.76], ["paste", 38.16], ["it,", 38.48], ["done.", 38.88],
  ["Pennies", 39.44], ["an", 39.92], ["hour.", 40.08], ["Or", 40.64], ["go", 40.88], ["fully", 41.12], ["local.", 41.52], ["No", 42.16], ["telemetry.", 42.4],
  ["Dictum.", 43.28], ["Free,", 44.16], ["open", 44.8], ["source.", 45.12], ["Star", 45.84], ["it", 46.04], ["on", 46.24], ["GitHub", 46.4],
  ["and", 47.12], ["stop", 47.36], ["paying", 47.68], ["to", 48.0], ["talk.", 48.16],
];

// Caption phrases, as [first word index, last word index]. null = hidden
// (the scene itself spells the words out on screen).
export const PHRASES: ([number, number] | null)[] = [
  null, null, [9, 11], [12, 17], [18, 19], [20, 23], [24, 26], [27, 31],
  [32, 36], [37, 39], [40, 43], [44, 47], [48, 49], [50, 51], null,
  [58, 61], [62, 64], [65, 70], [71, 74], [75, 80], [81, 87], [88, 94],
  [95, 99], [100, 102], [103, 105], [106, 109], [110, 111], [112, 115], [116, 119], null,
];

export const w = (i: number) => WORDS[i][1];
