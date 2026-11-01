import type { StepId } from '@/lib/steps'
import type { ProcessParams, QuizQuestion } from '@/lib/types'

export interface Concept {
  id: string
  title: string
  summary: string
  detail: string
  icon: 'scissors' | 'baseline' | 'sigma' | 'filter' | 'trash' | 'anchor'
}

export const CONCEPTS: Concept[] = [
  {
    id: 'epoch',
    title: 'What is an epoch?',
    icon: 'scissors',
    summary: 'A fixed window of EEG cut around one event.',
    detail:
      'If the stimulus appears at time 0, an epoch from −200 to 800 ms holds 200 ms of "before" and 800 ms of "after". Every event gives one epoch, and all epochs line up on the event, so their samples can be compared point by point.',
  },
  {
    id: 'baseline',
    title: 'Baseline correction',
    icon: 'baseline',
    summary: 'Subtract the pre-stimulus level so every epoch starts at zero.',
    detail:
      'EEG drifts slowly, so epochs start at different voltages. Subtracting each epoch\'s mean over the baseline window (usually just before the event) removes that offset. If the baseline window overlaps the response, part of the ERP is subtracted too.',
  },
  {
    id: 'averaging',
    title: 'Why averaging works',
    icon: 'sigma',
    summary: 'Time-locked activity adds up; random noise cancels as 1/√N.',
    detail:
      'The ERP is the same on every trial, while background EEG is different each time. Averaging N trials leaves the ERP unchanged and divides the noise by √N: 4 trials halve it, 100 trials cut it to a tenth. That is why ERP studies need many trials per condition.',
  },
  {
    id: 'filters',
    title: 'Filters change ERPs',
    icon: 'filter',
    summary: 'High-pass removes drift but also slow components; low-pass smooths.',
    detail:
      'A high-pass filter at 0.1 Hz removes slow drift. Raise it to 1–2 Hz and broad components like the P300 shrink and can even gain fake opposite-polarity bumps. A 30 Hz low-pass removes muscle and line noise, while very low cut-offs smear sharp peaks in time.',
  },
  {
    id: 'rejection',
    title: 'What rejection costs',
    icon: 'trash',
    summary: 'Dropping artefacts cleans the average but lowers the trial count.',
    detail:
      'Blinks produce swings of 100 µV or more over frontal electrodes. A peak-to-peak threshold drops those epochs. Too lax and blinks leak into the ERP; too strict and good trials are thrown away, so the average gets noisier. Watch the drop log to see what the threshold removes.',
  },
  {
    id: 'reference',
    title: 'Choosing the reference',
    icon: 'anchor',
    summary: 'Every voltage is measured against something.',
    detail:
      'EEG is a difference between two sites. The average reference uses the mean of all electrodes; a mastoid or single-channel reference makes that channel flat and changes amplitudes everywhere else. ERP amplitudes are only comparable between studies that use the same reference.',
  },
]

export interface Experiment {
  id: string
  title: string
  instruction: string
  watch: string
  step: StepId
  changes: Partial<ProcessParams> | ((p: ProcessParams) => Partial<ProcessParams>)
  trialsN?: number | null
}

export const EXPERIMENTS: Experiment[] = [
  {
    id: 'hp2',
    title: 'High-pass at 2 Hz',
    instruction: 'Sets the high-pass filter to 2 Hz.',
    watch: 'Compare the peak amplitude in the peak table with what you had before. Pin the old curve first to see both.',
    step: 'erp',
    changes: { l_freq: 2 },
  },
  {
    id: 'one-trial',
    title: 'Average a single trial',
    instruction: 'Uses only one trial per condition.',
    watch: 'Can you still see the ERP? Slide "Trials averaged" up and watch the noise fall along the 1/√N curve.',
    step: 'erp',
    changes: {},
    trialsN: 1,
  },
  {
    id: 'no-reject',
    title: 'Turn rejection off',
    instruction: 'Sets the threshold to 0, so blinks stay in.',
    watch: 'Look at frontal channels (Fp1, Fz) in the ERP and on the scalp map. Do blinks leak into the average?',
    step: 'epoching',
    changes: { reject_uv: 0 },
  },
  {
    id: 'strict',
    title: 'A very strict threshold',
    instruction: 'Sets the threshold to 40 µV.',
    watch: 'How many epochs survive? What happens to the confidence bands in the ERP step?',
    step: 'epoching',
    changes: { reject_uv: 40 },
  },
  {
    id: 'late-baseline',
    title: 'A baseline after the stimulus',
    instruction: 'Moves the baseline window to 0–200 ms.',
    watch: 'Part of the response is now subtracted. What happens to the early part of the ERP and to the peak amplitude?',
    step: 'erp',
    changes: (p) => ({ baseline: true, baseline_start: 0, baseline_end: Math.min(0.2, p.tmax) }),
  },
]

export const QUIZ: QuizQuestion[] = [
  {
    question: 'You average 25 trials and the residual noise is 4 µV. Roughly how much noise is left with 100 trials?',
    options: ['1 µV', '2 µV', '4 µV', '8 µV'],
    answer_index: 1,
    explanation: 'Noise falls as 1/√N. Four times the trials gives √4 = 2 times less noise: 4 µV → 2 µV.',
  },
  {
    question: 'What does baseline correction subtract from each epoch?',
    options: [
      'The average of all epochs',
      'Its own mean voltage in the baseline window',
      'The signal of the reference electrode',
      'Frequencies below the high-pass cut-off',
    ],
    answer_index: 1,
    explanation: 'Each epoch has its own mean over the baseline window (usually pre-stimulus) removed, so all epochs start from the same level.',
  },
  {
    question: 'Raising the high-pass filter from 0.1 Hz to 2 Hz will most likely…',
    options: ['Make the P300 larger', 'Leave the P300 unchanged', 'Shrink and distort the P300', 'Remove blinks completely'],
    answer_index: 2,
    explanation: 'The P300 is a slow wave with much energy below 2 Hz, so a 2 Hz high-pass removes part of it and can add artefactual bumps.',
  },
  {
    question: 'Most of your rejected epochs are blamed on Fp1 and Fp2. The likely cause is…',
    options: ['Eye blinks', 'Line noise at 50 Hz', 'A loose occipital electrode', 'Too many conditions'],
    answer_index: 0,
    explanation: 'Fp1/Fp2 sit just above the eyes. Blinks produce large, slow frontal deflections that exceed peak-to-peak thresholds.',
  },
  {
    question: 'Where on the scalp is the P300 to rare targets usually largest?',
    options: ['Frontal pole (Fp1/Fp2)', 'Temporal (T7/T8)', 'Parietal midline (Pz)', 'It is the same everywhere'],
    answer_index: 2,
    explanation: 'The classic P3b has a parietal-midline maximum, which is why Pz is the usual channel for measuring it.',
  },
  {
    question: 'Latency jitter (the P300 arriving at slightly different times on each trial) makes the averaged P300…',
    options: ['Taller and narrower', 'Smaller and wider', 'Exactly the same', 'Change polarity'],
    answer_index: 1,
    explanation: 'Averaging peaks that do not line up spreads them out in time: the average is flatter and broader than any single-trial peak.',
  },
  {
    question: 'A very strict rejection threshold (e.g. 30 µV) mainly risks…',
    options: [
      'Letting blinks into the average',
      'Throwing away good trials, leaving a noisier average',
      'Shifting the ERP latency',
      'Changing the reference',
    ],
    answer_index: 1,
    explanation: 'Normal EEG often swings more than 30 µV, so many clean trials are dropped. Fewer trials means more residual noise.',
  },
  {
    question: 'Why does the epoch window usually start before the event (e.g. at −200 ms)?',
    options: [
      'To capture responses that start before the stimulus',
      'To have a baseline period for correction and comparison',
      'Because MNE requires negative tmin',
      'To make the epochs longer for filtering',
    ],
    answer_index: 1,
    explanation: 'The pre-stimulus part is the baseline: a reference level of "no response" that the ERP is measured against.',
  },
]
