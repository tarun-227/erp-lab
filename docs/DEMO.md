# 10-minute demo script

Four speakers, about two and a half minutes each. Start the app beforehand (`python run.py`), clear the
browser's local storage (so the tour shows), and open the Explain panel.

## 1. The problem and the data (Load, Events) – speaker 1

- One sentence on what an ERP is: a few microvolts hidden in EEG ten times larger.
- Show the tour and the three samples, then load the flanker task from ERP CORE, with stimulus and response events.
- Events step: correct responses vastly outnumber errors. Ask: which average will be noisier, and why?

## 2. Epoching (step 3) – speaker 2

- The raw trace with shaded epoch windows; move the epoch window and watch the boxes follow.
- Set the threshold to 0, then 40 µV: watch the kept count and the drop log (blinks on Fp1/Fp2).
- Click a grey row in the ERP image: the raw view jumps to that trial and shows the blink.

## 3. The ERP (step 4) – speaker 3

- ERN preset: the error − correct difference wave dips negative within 100 ms of the response at FCz.
- Click the ERP at ~50 ms: the scalp map shows a fronto-central negativity. Press Play.
- Trials averaged: slide from 1 to all; the noise plot follows 1/√N.
- Pin, raise the high-pass to 2 Hz, compare: the waveform changes shape.

## 4. Learning, tutor and export (steps 5–6) – speaker 4

- Run one "Try this" experiment and answer a quiz question.
- If keys are set: ask the tutor "Is my ERN real or noise?", show an action card, Apply and Undo;
  "Explain this plot" on the scalp map.
- Export: the script, then (optionally, in a terminal) run it on the downloaded recording and show the same
  peak values.
- Close with the Flanker P3 preset: stimulus-locked P3 at Pz, compatible vs incompatible.
- If time allows, load the flicker sample: the average oscillates instead of showing one peak, so count the cycles.

## Likely viva questions

- Why baseline-correct, and what goes wrong if the baseline overlaps the response?
- Why does a high-pass above 1 Hz distort the P300?
- How is the scalp map computed? (thin-plate spline interpolation of the channel values, `core/topo.py`)
- How do you know the app is correct? (tests on the real sample check the ERN and P3 are found; the exported script reproduces the
  app's ERP exactly in `test_codegen.py`)
- What does the tutor see, and what stops it from changing the app by itself?
