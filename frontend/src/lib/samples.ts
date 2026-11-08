export type SampleId = 'flanker' | 'oddball' | 'ssvep'

export interface Sample {
  id: SampleId
  title: string
  /** What kind of experiment it is, in a few words. */
  kind: string
  text: string
  /** What a student should find in it; each one is checked by backend/tests/test_samples.py. */
  lookFor: { name: string; what: string }[]
}

export const SAMPLES: Sample[] = [
  {
    id: 'flanker',
    title: 'Flanker task',
    kind: 'Visual · errors and responses',
    text: 'One participant from ERP CORE. A central arrow points left or right and is flanked by arrows pointing the same way (compatible) or the other way (incompatible). The participant presses the button for the central arrow; some presses are errors.',
    lookFor: [
      { name: 'ERN', what: 'a negative wave at FCz right after error responses.' },
      { name: 'P3', what: 'a positive wave at Pz after the stimulus.' },
    ],
  },
  {
    id: 'oddball',
    title: 'Auditory oddball',
    kind: 'Hearing · rare sounds',
    text: 'One participant from OpenNeuro, eyes closed. Most sounds are low tones; a few are higher target tones that need a keypress, and a few are bursts of noise.',
    lookFor: [
      { name: 'N1', what: 'a negative wave at Cz about 100 ms after every sound.' },
      { name: 'P300', what: 'a large positive wave at CPz about 400 ms after rare target tones.' },
    ],
  },
  {
    id: 'ssvep',
    title: 'Flickering light (SSVEP)',
    kind: 'Vision · steady rhythm',
    text: 'One participant watching a stimulus that flickers at 12 or 15 Hz for 20 s at a time. Each trial is split into one-second segments, so every event here is a segment start, not a new stimulus.',
    lookFor: [
      { name: 'Steady-state response', what: 'at O2 the average keeps oscillating at the flicker rate instead of showing one peak. Switch off the difference wave and count the cycles in one second.' },
    ],
  },
]
