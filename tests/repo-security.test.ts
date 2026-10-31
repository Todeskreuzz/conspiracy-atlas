import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

// The repository is public: these checks keep secrets out of it and stop workflows
// from handing write access or secrets to code from forks.
const workflows = readdirSync('.github/workflows')
  .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  .map((f) => ({ name: f, text: readFileSync(`.github/workflows/${f}`, 'utf8') }));

describe('repository security', () => {
  it('ignores local secret files', () => {
    const ignore = readFileSync('.gitignore', 'utf8');
    for (const entry of ['.dev.vars', '.env', 'backups/*', '*.pem', '*.key']) {
      expect(ignore.split(/\r?\n/)).toContain(entry);
    }
  });

  it('tracks no secret or database files', () => {
    const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n');
    const bad = tracked.filter(
      (f) =>
        /(^|\/)\.dev\.vars$/.test(f) ||
        /(^|\/)\.env(\.(?!example$).*)?$/.test(f) ||
        /\.(pem|key|p12|pfx|sqlite3?|db)$/.test(f) ||
        (f.startsWith('backups/') && f !== 'backups/.gitkeep'),
    );
    expect(bad).toEqual([]);
  });

  it('never runs fork code with secrets or write access', () => {
    for (const w of workflows) {
      expect(w.text, w.name).not.toMatch(/pull_request_target|workflow_run/);
      expect(w.text, w.name).toMatch(/^permissions:/m);
      expect(w.text, w.name).not.toMatch(/:\s*write\b|write-all/);
      expect(w.text, w.name).not.toMatch(/\$\{\{\s*secrets\./);
    }
  });

  it('pins third-party actions to a commit', () => {
    for (const w of workflows) {
      for (const m of w.text.matchAll(/uses:\s*([^\s#]+)/g)) {
        expect(m[1], `${w.name}: ${m[1]}`).toMatch(/@[0-9a-f]{40}$/);
      }
    }
  });
});
