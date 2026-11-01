-- "Wahr oder erfunden?": one answer per account and documented event. The points come from the
-- correct answers; the question itself is derived from the event (see shared/quiz.ts), so nothing else is stored.
CREATE TABLE quiz_answers (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX idx_quiz_answers_user ON quiz_answers(user_id);
