// "Wahr oder erfunden?": a documented historical event is shown with a year. Some years are the real
// one, some are changed. Whether the year is real depends on the event id alone, so the server can grade an
// answer without storing the question, and nobody can re-roll a question to find the answer.

export const QUIZ_POINTS = 10;

/** Years are shifted by 2 to 16 years for the wrong statements. */
const SHIFT_MIN = 2;
const SHIFT_SPAN = 15;

function hash(n: number): number {
  let h = 0x811c9dc5;
  for (const ch of String(n)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return h >>> 0;
}

export interface QuizQuestion {
  /** The year shown in the statement. */
  year: number;
  /** True when `year` is the real start year of the event. */
  isTrue: boolean;
}

export function quizQuestion(eventId: number, startYear: number): QuizQuestion {
  const h = hash(eventId);
  if (h % 2 === 0) return { year: startYear, isTrue: true };
  const shift = SHIFT_MIN + ((h >>> 1) % SHIFT_SPAN);
  const sign = (h >>> 8) % 2 === 0 ? 1 : -1;
  return { year: startYear + sign * shift, isTrue: false };
}

export function quizCorrect(verdictTrue: boolean, question: QuizQuestion): boolean {
  return verdictTrue === question.isTrue;
}
