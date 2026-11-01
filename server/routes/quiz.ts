import { Hono } from 'hono';
import type { AppEnv, Ctx } from '../http';
import { readJson } from '../http';
import { Db } from '../db';
import { requireFeature } from '../features';
import { ApiError, notFound } from '../errors';
import { assertSameOrigin, rateLimit } from '../security';
import { loadUserSession, requireUser } from '../users';
import { ValidationError, int } from '../../shared/validation';
import { QUIZ_POINTS, quizCorrect, quizQuestion } from '../../shared/quiz';
import { EVENT_FIELDS, EVENT_SELECT, mapEvent, translate } from '../repo';

/**
 * "Wahr oder erfunden?" – questions come from documented historical events in the archive.
 * Reading the next question works without an account; answering and the points need a signed-in account.
 * Each account answers each event once.
 */
export const quizRoutes = new Hono<AppEnv>();

/** Only documented events with a known year; periods are left out because one year would not be a fair question. */
const QUIZ_EVENTS = "e.is_period = 0 AND e.start_year IS NOT NULL AND e.evidence_status = 'historically_documented'";

export interface QuizStats {
  answered: number;
  correct: number;
  points: number;
}

export async function quizStats(db: Db, userId: number): Promise<QuizStats> {
  const row = await db.first<{ answered: number; correct: number | null }>(
    'SELECT COUNT(*) AS answered, COALESCE(SUM(correct), 0) AS correct FROM quiz_answers WHERE user_id = ?',
    userId,
  );
  const correct = Number(row?.correct ?? 0);
  return { answered: Number(row?.answered ?? 0), correct, points: correct * QUIZ_POINTS };
}

function writeGuard(c: Ctx) {
  requireFeature(c.env, 'accounts');
}

quizRoutes.get('/quiz/next', async (c) => {
  writeGuard(c);
  const db = Db.from(c.env);
  const session = await loadUserSession(db, c.req.raw);
  c.header('Cache-Control', 'private, no-store');
  if (!session) return c.json({ authenticated: false, question: null, done: false, stats: null });
  const row = await db.first(
    `${EVENT_SELECT} WHERE ${QUIZ_EVENTS} AND e.id NOT IN (SELECT event_id FROM quiz_answers WHERE user_id = ?) ORDER BY RANDOM() LIMIT 1`,
    session.userId,
  );
  const stats = await quizStats(db, session.userId);
  if (!row) return c.json({ authenticated: true, question: null, done: true, stats });
  const [event] = await translate(db, c.get('locale'), 'event', [mapEvent(row)], EVENT_FIELDS);
  const { year } = quizQuestion(event.id, event.startYear);
  return c.json({ authenticated: true, question: { eventId: event.id, title: event.title, year }, done: false, stats });
});

quizRoutes.post('/quiz/answer', async (c) => {
  writeGuard(c);
  assertSameOrigin(c.req.raw);
  const db = Db.from(c.env);
  const user = await requireUser(db, c.req.raw);
  const body = await readJson(c, 1_000);
  const eventId = int(body.eventId, 'eventId', { min: 1 }) as number;
  if (typeof body.verdict !== 'boolean') throw new ValidationError('verdict', 'must be true or false');
  await rateLimit(db, c.env, c.req.raw, `quiz:${user.userId}`, 120, 3600);
  const row = await db.first(`${EVENT_SELECT} WHERE ${QUIZ_EVENTS} AND e.id = ?`, eventId);
  if (!row) throw notFound('Question');
  const event = mapEvent(row);
  const already = await db.first('SELECT 1 AS x FROM quiz_answers WHERE user_id = ? AND event_id = ?', user.userId, eventId);
  if (already) throw new ApiError(409, 'already_answered', 'This question was already answered', undefined, 'eventId');
  const question = quizQuestion(event.id, event.startYear);
  const correct = quizCorrect(body.verdict, question);
  await db.run('INSERT INTO quiz_answers (user_id, event_id, correct) VALUES (?, ?, ?)', user.userId, event.id, correct ? 1 : 0);
  const [translated] = await translate(db, c.get('locale'), 'event', [event], EVENT_FIELDS);
  return c.json({
    correct,
    realYear: event.startYear,
    year: question.year,
    event: { slug: event.slug, title: translated.title },
    stats: await quizStats(db, user.userId),
  });
});
