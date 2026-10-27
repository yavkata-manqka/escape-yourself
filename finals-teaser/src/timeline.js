// Shared timing for the finals teaser (seconds). 100 BPM -> one beat = 0.6 s.
// Picture, music and voice-over all read this file.
export const FPS = 30;
export const BEAT = 0.6;
export const DURATION = 32.0; // 960 frames

export const T = {
  // 1. qualifications are over (map of Bulgaria, gold pulse)
  intro: 0.0,
  title1: 0.6,
  // 2. scale: teams light up in five cities, counters (each counter lands with its spoken phrase)
  teams: 3.0,
  counter1: 3.4,
  counter2: 4.4,
  counter3: 5.0,
  // 3. the cut: teams rise into a wall of light, then go dark in waves -> 8 remain
  rise: 7.8,
  waves: [9.6, 10.2, 10.8, 11.4, 12.0],
  cutText: 9.0,
  // 4. the strongest 8: light columns in a championship line-up
  lineup: 13.2,
  columnStep: 0.6, // one column per beat, 13.2 .. 17.4
  strongest: 15.0,
  // 5. the final
  flythrough: 18.6,
  finalHit: 19.8,
  // 6. call to action: email notification -> "до 29.10" -> "СЛЕДИ ИМЕЙЛА СИ."
  cta: 23.4,
  ctaWhen: 24.4,
  ctaFollow: 26.5,
  ctaSpam: 27.1,
  // 7. end card with logos (held to the end)
  endCard: 28.2,
};

// Recorded voice-over: [start, end] of each phrase in the raw take (seconds) -> where it plays.
export const VO = [
  { src: [0.86, 2.00], at: 0.75, text: 'Квалификациите приключиха.' },
  { src: [2.67, 3.49], at: 3.35, text: 'Над петдесет отбора.' },
  { src: [4.03, 4.36], at: 4.40, text: 'Пет града.' },
  { src: [5.05, 5.49], at: 5.00, text: 'Една седмица.' },
  { src: [6.30, 7.59], at: 9.05, text: 'Но само осем продължават.' },
  { src: [8.28, 9.82], at: 15.05, text: 'Осемте най-силни отбора в България.' },
  { src: [10.59, 11.09], at: 20.15, text: 'Седми ноември.' },
  { src: [11.59, 11.93], at: 20.95, text: 'София.' },
  { src: [12.62, 12.92], at: 21.65, text: 'Финалът.' },
  { src: [13.77, 14.21], at: 23.70, text: 'Кои са те?' },
  { src: [14.95, 16.80], at: 24.45, text: 'Ще разберете до двайсет и девети октомври.' },
  { src: [17.39, 18.03], at: 26.55, text: 'Следи имейла си.' },
];
