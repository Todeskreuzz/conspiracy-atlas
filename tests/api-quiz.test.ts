import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { client, makeEnv } from './helpers/app';
import { turnstileFetch } from '../server/routes/community';
import { quizCorrect, quizQuestion } from '../shared/quiz';

const PASSWORD = 'a long secret password';
const original = turnstileFetch.impl;
beforeEach(() => {
  turnstileFetch.impl = (async () => new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
});
afterEach(() => {
  turnstileFetch.impl = original;
});

async function player(env: Awaited<ReturnType<typeof makeEnv>>, username: string) {
  const c = client(env);
  const r = await c.post('/api/account/register', { username, password: PASSWORD, displayName: username.toUpperCase(), turnstileToken: 'ok' });
  expect(r.status).toBe(201);
  c.setCsrf(r.json.csrfToken);
  return c;
}

describe('quiz logic', () => {
  it('derives the same question for the same event and grades it', () => {
    expect(quizQuestion(42, 1969)).toEqual(quizQuestion(42, 1969));
    let truths = 0;
    for (let id = 1; id <= 200; id++) {
      const q = quizQuestion(id, 1900);
      if (q.isTrue) {
        truths++;
        expect(q.year).toBe(1900);
      } else {
        expect(Math.abs(q.year - 1900)).toBeGreaterThanOrEqual(2);
        expect(Math.abs(q.year - 1900)).toBeLessThanOrEqual(16);
      }
    }
    expect(truths).toBeGreaterThan(60);
    expect(truths).toBeLessThan(140);
    expect(quizCorrect(true, { year: 1900, isTrue: true })).toBe(true);
    expect(quizCorrect(false, { year: 1910, isTrue: false })).toBe(true);
    expect(quizCorrect(true, { year: 1910, isTrue: false })).toBe(false);
  });
});

describe('quiz API', () => {
  it('serves questions to visitors without a question, and to accounts with one', async () => {
    const env = await makeEnv();
    const visitor = client(env);
    expect((await visitor.get('/api/quiz/next')).json).toMatchObject({ authenticated: false, question: null });
    expect((await visitor.post('/api/quiz/answer', { eventId: 1, verdict: true })).status).toBe(401);

    const c = await player(env, 'quiz_player');
    const next = await c.get('/api/quiz/next');
    expect(next.json.authenticated).toBe(true);
    expect(next.json.question).toEqual(expect.objectContaining({ eventId: expect.any(Number), title: expect.any(String), year: expect.any(Number) }));
    expect(next.json.stats).toEqual({ answered: 0, correct: 0, points: 0 });
  });

  it('grades an answer once, awards points and shows the real year', async () => {
    const env = await makeEnv();
    const c = await player(env, 'quiz_grader');
    const { question } = (await c.get('/api/quiz/next')).json;
    const verdict = true;
    const r = await c.post('/api/quiz/answer', { eventId: question.eventId, verdict });
    expect(r.status).toBe(200);
    expect(r.json.year).toBe(question.year);
    expect(r.json.correct).toBe(question.year === r.json.realYear);
    expect(r.json.stats).toEqual({ answered: 1, correct: r.json.correct ? 1 : 0, points: r.json.correct ? 10 : 0 });
    expect(r.json.event.slug).toEqual(expect.any(String));

    expect((await c.post('/api/quiz/answer', { eventId: question.eventId, verdict: !verdict })).status).toBe(409);
    expect((await c.post('/api/quiz/answer', { eventId: question.eventId, verdict: 'yes' })).status).toBe(400);
    expect((await c.post('/api/quiz/answer', { eventId: 999999, verdict })).status).toBe(404);

    const next = await c.get('/api/quiz/next');
    expect(next.json.question.eventId).not.toBe(question.eventId);
    const profile = await client(env).get('/api/users/quiz_grader');
    expect(profile.json.stats.quiz).toEqual({ answered: 1, correct: r.json.correct ? 1 : 0, points: r.json.correct ? 10 : 0 });
  });
});
