// Shared timing for the finals teaser (seconds). The picture follows the recorded voice:
// every scene starts on its spoken phrase. Picture, music and voice-over all read this file.
export const FPS = 30;
export const BEAT = 0.6;
export const DURATION = 25.6; // 768 frames

export const T = {
  // 1. scale: the map lights up, counters slam in with the voice
  teams: 0.2,
  stat1: 0.4,   // 50+ ОТБОРА
  stat2: 1.95,  // 200+ ИГРАЧИ
  stat3: 3.15,  // 5 ГРАДА
  stat4: 3.65,  // 1 СЕДМИЦА
  // 2. "на косъм": anonymous light lanes racing (no real results are implied)
  race1: 4.75,  // close finish -> "СЕКУНДИ."
  race2: 7.05,  // one lane far ahead -> "УБЕДИТЕЛНО."
  much: 9.1,    // "МНОГО ЗА МАЛКО."
  hair: 9.85,   // "НА КОСЪМ."
  rise: 4.6,    // behind the race, the team lights rise into the wall
  // 3. the cut: 52 -> 8
  cutText: 10.9,
  waves: [10.9, 11.25, 11.6, 11.95, 12.3],
  // 4. line-up of the 8 + "оспорван до последната секунда"
  lineup: 12.9,
  columnStep: 0.3,
  sure: 13.0,
  contested: 13.75,
  // 5. the final
  flythrough: 15.9,
  finalHit: 16.5,
  // 6. call to action
  cta: 18.1,
  ctaWhen: 18.4,
  ctaFollow: 20.45,
  ctaSpam: 20.9,
  // 7. end card (held ~4 s)
  endCard: 21.4,
};

// Recorded voice-over (New_Recording_2): [start, end] in the raw take -> where it plays.
export const VO = [
  { src: [0.70, 2.06], at: 0.40, text: 'Над петдесет отбора.' },
  { src: [2.91, 3.95], at: 1.95, text: 'Над двеста играчи.' },
  { src: [4.88, 5.23], at: 3.15, text: 'Пет града.' },
  { src: [5.89, 6.56], at: 3.65, text: 'Една седмица.' },
  { src: [7.26, 9.32], at: 4.75, text: 'В някои градове решаваха секундите.' },
  { src: [10.01, 10.43], at: 7.05, text: 'В други' },
  { src: [10.78, 11.90], at: 7.60, text: 'разликата беше убедителна.' },
  { src: [12.80, 13.36], at: 9.10, text: 'Много за малко.' },
  { src: [14.05, 14.51], at: 9.85, text: 'Всичко — на косъм.' },
  { src: [15.73, 17.12], at: 10.90, text: 'Само осем отбора продължават.' },
  { src: [17.96, 18.51], at: 13.00, text: 'Едно е сигурно' },
  { src: [19.26, 21.27], at: 13.75, text: 'финалът ще е оспорван до последната секунда.' },
  { src: [21.95, 22.47], at: 16.60, text: 'Седми ноември.' },
  { src: [22.96, 23.30], at: 17.35, text: 'София.' },
  { src: [23.97, 24.48], at: 18.40, text: 'Финалистите' },
  { src: [25.21, 26.29], at: 19.05, text: 'до двайсет и девети октомври.' },
  { src: [26.87, 27.39], at: 20.45, text: 'Следи имейла си.' },
];
