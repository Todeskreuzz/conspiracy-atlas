import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api, ApiFailure } from '../api/client';
import { accountApi, useAccount } from '../api/account';
import { useFeature } from '../api/status';
import { Unavailable } from '../components/Unavailable';
import { QUIZ_POINTS } from '../../shared/quiz';

interface QuizStats {
  answered: number;
  correct: number;
  points: number;
}

interface QuizNext {
  authenticated: boolean;
  question: { eventId: number; title: string; year: number } | null;
  done: boolean;
  stats: QuizStats | null;
}

interface QuizAnswer {
  correct: boolean;
  realYear: number;
  year: number;
  event: { slug: string; title: string };
  stats: QuizStats;
}

/** "Wahr oder erfunden?": one documented event per question, points for correct answers, saved on the account. */
export default function QuizPage() {
  const { t } = useI18n();
  const feature = useFeature('accounts');
  const account = useAccount();
  const location = useLocation();
  const [answer, setAnswer] = useState<QuizAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const signedIn = !!account.user;
  const next = useAsync((signal) => api<QuizNext>('/quiz/next', { signal }), [account.user?.id ?? 0]);
  const loginLink = `/login?next=${encodeURIComponent(location.pathname)}`;
  const q = next.data;
  const stats = answer?.stats ?? q?.stats ?? null;

  const submit = async (verdict: boolean) => {
    if (!q?.question) return;
    setBusy(true);
    setError(null);
    try {
      setAnswer(await accountApi(account.csrfToken).post<QuizAnswer>('/quiz/answer', { eventId: q.question.eventId, verdict }));
    } catch (e) {
      setError(e instanceof ApiFailure ? e : new ApiFailure(0, 'error', String(e), null));
    } finally {
      setBusy(false);
    }
  };

  const nextQuestion = () => {
    setAnswer(null);
    setError(null);
    next.reload();
  };

  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.quiz')}</div>
        <h1>{t('quiz.title')}</h1>
        <p>{t('quiz.intro', { points: QUIZ_POINTS })}</p>
      </header>

      {feature.loaded && !feature.available && <Unavailable feature="accounts" state={feature.state} />}

      {feature.available && !account.loading && !signedIn && (
        <p className="notice">
          <Link to={loginLink} className="btn btn--small btn--primary">
            {t('quiz.signIn')}
          </Link>{' '}
          <span className="muted small">{t('quiz.signInHint')}</span>
        </p>
      )}

      {feature.available && signedIn && stats && (
        <p className="small muted" data-testid="quiz-score">
          {t('quiz.score', { points: stats.points, correct: stats.correct, answered: stats.answered })}
        </p>
      )}

      {next.error && (next.error instanceof ApiFailure && next.error.unavailable ? (
        <Unavailable feature="accounts" state={next.error.state!} compact />
      ) : (
        <p className="notice notice--error">{next.error.message}</p>
      ))}

      {signedIn && !next.loading && q?.question && !q.done && (
        <section className="paper" data-testid="quiz-question">
          <p>{t('quiz.statement', { title: q.question.title, year: q.question.year })}</p>
          {!answer && (
            <div className="btn-row">
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => submit(true)}>
                {t('quiz.true')}
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => submit(false)}>
                {t('quiz.false')}
              </button>
            </div>
          )}
          {answer && (
            <div role="status">
              <p className={answer.correct ? 'notice' : 'notice notice--error'}>
                {answer.correct ? t('quiz.correct', { points: QUIZ_POINTS }) : t('quiz.wrong')}
              </p>
              <p>{t('quiz.realYear', { year: answer.realYear })}</p>
              <div className="btn-row">
                <Link to={`/events/${answer.event.slug}`} className="btn btn--small">
                  {t('quiz.explore')}
                </Link>
                <button type="button" className="btn btn--primary" onClick={nextQuestion}>
                  {t('quiz.next')}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {signedIn && !next.loading && q?.done && <p className="notice">{t('quiz.done')}</p>}

      {error && (error.unavailable ? <Unavailable feature="accounts" state={error.state!} compact /> : <p className="notice notice--error">{error.message}</p>)}
    </div>
  );
}
