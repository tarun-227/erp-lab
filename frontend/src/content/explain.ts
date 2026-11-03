import type { StepId } from '@/lib/steps'

export interface ExplainEntry {
  title: string
  body: string[]
  tryThis?: string[]
  questions?: string[]
  /** "You'll learn" list shown under the step title. */
  objectives?: string[]
}

export const EXPLAIN: Record<StepId, ExplainEntry> = {
  load: {
    objectives: ['What an ERP is and why it hides in EEG', 'What a recording and its events contain'],
    title: 'What is an ERP?',
    body: [
      'An event-related potential (ERP) is the small, time-locked voltage change the brain produces in response to an event, such as a tone or a flash. It is usually only a few microvolts, buried in background EEG that is ten times larger.',
      'The trick is repetition: show the same kind of event many times, cut out the EEG around each one, and average. Activity that is locked to the event survives; everything else averages towards zero.',
      'The sample recording is a flanker task from ERP CORE. A central arrow is flanked by arrows pointing the same way (compatible) or the other way (incompatible), and the participant presses a button for the central arrow. Stimuli evoke a P3 over Pz; error responses are followed within about 100 ms by the error-related negativity (ERN), largest at FCz.',
    ],
    tryThis: [
      'Load the sample and count the events: how many error responses are there compared with correct ones?',
      'Later, in the ERP step, set "Trials averaged" to 1 and see whether you can spot the ERN in a single error trial.',
    ],
    questions: [
      'Why can you not see an ERP in a single trial of raw EEG?',
      'Errors are rare in this task. What does that mean for how clean the error average can be?',
    ],
  },
  events: {
    objectives: ['How event codes map to conditions', 'Why rare conditions give noisier averages'],
    title: 'Events and conditions',
    body: [
      'Each event marks the moment a stimulus appeared or a response was made. Its numeric code tells you which condition it belongs to.',
      'Naming the codes (for example 1 = standard, 2 = target) lets you average each condition separately and compare them. A difference wave (target − standard) isolates what is special about one condition.',
      'Rare conditions give fewer epochs, so their averages are noisier. That is the price of an oddball design.',
    ],
    tryThis: ['Untick one condition and see how the later steps change.', 'In the real sample, compare stimulus-locked events with response-locked ones.'],
    questions: [
      'You have 160 standards and 40 targets. Which average will be noisier, and by roughly how much?',
      'What does it mean for an analysis to be "response-locked" instead of "stimulus-locked"?',
    ],
  },
  epoching: {
    objectives: ['How an epoch window and baseline work', 'What filters and the reference change', 'How artefact rejection trades data for cleanliness'],
    title: 'Cutting the signal into epochs',
    body: [
      'An epoch is a fixed window of EEG around one event, for example from 200 ms before to 800 ms after it. The pre-stimulus part is the baseline.',
      'The band-pass filter removes slow drifts (high-pass) and fast noise (low-pass) before epoching. The reference decides what each voltage is measured against.',
      'Peak-to-peak rejection drops any epoch whose voltage swing on any channel exceeds the threshold. Blinks are the usual culprit; they are largest on Fp1 and Fp2.',
      'In the ERP image each row is one epoch. Vertical stripes are activity locked to the event; random speckle is noise.',
    ],
    tryThis: [
      'Set the threshold to 0 (off), then to 40 µV. Watch the drop log and the kept count.',
      'Move the epoch window so it starts at 0. What happens to the baseline?',
      'Click a grey (rejected) row in the ERP image and find it in the raw signal.',
    ],
    questions: [
      'Why does the epoch window start before the event?',
      'Which channels cause most rejections in your data, and why those?',
      'What is lost when the rejection threshold is very strict?',
    ],
  },
  erp: {
    objectives: ['Why averaging reveals the ERP (1/√N)', 'How to measure peak and mean amplitude', 'Where on the scalp an effect is largest'],
    title: 'Averaging into an ERP',
    body: [
      'Averaging N epochs shrinks random noise by a factor of √N: four times as many trials halves the noise. The noise plot shows this on your own data.',
      'The shaded band around each waveform is a 95% confidence interval. Where the bands of two conditions do not overlap, the difference is unlikely to be noise.',
      'The peak is the most positive (or negative) point inside the window you choose; the mean amplitude in a window is often a more robust measure than the peak.',
      'The scalp map shows where on the head the effect is largest at the time cursor. Click the ERP to move the cursor, or press play.',
      'The signed r² map tests every channel and moment at once: how well the voltage there tells the two conditions apart, trial by trial. BCIs use it to pick the channels and time windows a classifier should read. SME in the table is the expected error of each mean amplitude: fewer trials, larger SME.',
    ],
    tryThis: [
      'Set "Trials averaged" to 1, then slide it up slowly.',
      'Pin the current ERP, raise the high-pass to 2 Hz, and compare.',
      'Play the scalp map and find when the ERN is strongest, and where on the head.',
      'On the signed r² map, find the second, later effect after errors (a red band over central-parietal sites around 200–500 ms). Set the component to P300 and measure it.',
    ],
    questions: [
      'Is the ERN in your difference wave larger than the confidence bands of the two conditions?',
      'Why is the mean amplitude less sensitive to noise than the peak amplitude?',
    ],
  },
  learn: {
    objectives: ['Connect each idea to what you saw in the plots', 'Test yourself with the quiz'],
    title: 'Check your understanding',
    body: [
      'Open the concept cards for a short recap of each idea. The "Try this" experiments on the left change the settings for you and take you to the plot that shows the effect.',
      'The quiz checks the key ideas; if the AI tutor is enabled, it can also write questions about your own results and give feedback on a short written answer.',
    ],
  },
  export: {
    objectives: ['How to reproduce your analysis outside the app'],
    title: 'Reproducible analysis',
    body: [
      'Exporting the exact parameters as a Python script means anyone can reproduce your ERP from the same data with MNE-Python.',
      'Download the recording too: the script runs on that file and writes the averaged ERPs to erp-ave.fif.',
      'A share link carries only parameters, never data, so it is safe to post.',
    ],
    questions: ['Which parameters would a reader need to reproduce your ERP from a methods section?'],
  },
}
