// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { cleanup, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { renderApp } from './harness';
import { makeEnv } from '../helpers/app';
import { Unavailable } from '../../src/components/Unavailable';
import { I18nProvider } from '../../src/i18n';
import { render } from '@testing-library/react';
import { createDb } from '../helpers/d1';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => cleanup());

describe('frontend', () => {
  it('renders the archive from the API', async () => {
    renderApp('/archive', await makeEnv());
    const cards = await screen.findAllByTestId('theory-card', {}, { timeout: 5000 });
    expect(cards).toHaveLength(12);
    expect(screen.getByText('COINTELPRO')).toBeInTheDocument();
  });

  it('keeps the archive neutral and shows ratings only under Expert opinions', async () => {
    renderApp('/archive', await makeEnv());
    await screen.findAllByTestId('theory-card', {}, { timeout: 5000 });
    expect(document.querySelector('[data-status]')).toBeNull();
    expect(screen.queryByLabelText('Evidence status')).toBeNull();
    cleanup();

    renderApp('/theory/cointelpro', await makeEnv());
    await screen.findByTestId('theory-detail', {}, { timeout: 5000 });
    expect(document.querySelector('[data-status]')).toBeNull();
    expect(document.querySelector('.stamp')).toBeNull();
    expect(screen.getByTestId('expert-link')).toHaveAttribute('href', '/experts/cointelpro');
    cleanup();

    renderApp('/experts/cointelpro', await makeEnv());
    await screen.findByTestId('expert-case', {}, { timeout: 5000 });
    expect(screen.getAllByTestId('expert-claim').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-status]').length).toBeGreaterThan(0);
  });

  it('puts events and case files on the timeline and shows the connections of a selected case', async () => {
    const g = globalThis as { ResizeObserver?: unknown };
    g.ResizeObserver ??= class {
      observe() {}
      disconnect() {}
    };
    window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
    renderApp('/timeline?case=operation-northwoods', await makeEnv());
    const detail = await screen.findByTestId('timeline-detail', {}, { timeout: 5000 });
    await waitFor(() => expect(document.querySelectorAll('.chron-item--case').length).toBeGreaterThan(5));
    expect(document.querySelectorAll('.chron-item--event').length).toBeGreaterThan(5);
    expect(within(detail).getByRole('link', { name: 'Operation Northwoods' })).toHaveAttribute('href', '/theory/operation-northwoods');
    expect(screen.getByText('Northwoods memorandum declassified', { selector: 'button' })).toBeInTheDocument();
    expect(document.querySelectorAll('.chron-string').length).toBeGreaterThan(0);
    // The archive stays neutral: no evidence ratings on the timeline.
    expect(document.querySelector('[data-status]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Case files/ }));
    await waitFor(() => expect(document.querySelectorAll('.chron-item--case').length).toBe(0));
  });

  it('saves a case in the browser and lists it on the saved page', async () => {
    renderApp('/theory/cointelpro', await makeEnv());
    await screen.findByTestId('theory-detail', {}, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(screen.getByRole('button', { name: /Saved/ })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('ca.saved') ?? '[]')[0].slug).toBe('cointelpro');
    cleanup();

    renderApp('/saved', await makeEnv());
    const list = await screen.findByTestId('saved-list', {}, { timeout: 5000 });
    expect(within(list).getByText('COINTELPRO')).toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: /Saved/ }));
    await waitFor(() => expect(screen.queryByTestId('saved-list')).toBeNull());
  });

  it('marks community theories with a Community stamp and lists only them on the community page', async () => {
    const db = createDb();
    db.raw.exec(`INSERT INTO authors (id, display_name) VALUES (9001, 'Tester');
      INSERT INTO theories (slug, title, summary, category_id, evidence_status, author_id, origin, updated_at)
      VALUES ('community-test-case', 'Community test case', 'A theory written by a visitor.', (SELECT id FROM categories LIMIT 1), 'unverified', 9001, 'community', '2999-01-01');`);
    renderApp('/archive', await makeEnv({}, db));
    await screen.findByText('Community test case', {}, { timeout: 5000 });
    const card = screen.getByText('Community test case').closest('[data-testid="theory-card"]') as HTMLElement;
    expect(within(card).getByTestId('community-badge')).toBeInTheDocument();
    expect(screen.getByText('COINTELPRO').closest('[data-testid="theory-card"]')!.querySelector('[data-testid="community-badge"]')).toBeNull();
    cleanup();

    renderApp('/community', await makeEnv({}, db));
    await screen.findByText('Community test case', {}, { timeout: 5000 });
    expect(screen.getByRole('heading', { level: 1, name: 'Community conspiracy theories' })).toBeInTheDocument();
    expect(screen.getAllByTestId('theory-card')).toHaveLength(1);
  });

  it('lists the ratings of all cases under Expert opinions', async () => {
    renderApp('/experts', await makeEnv());
    const list = await screen.findByTestId('expert-list', {}, { timeout: 5000 });
    expect(within(list).getByText('COINTELPRO')).toBeInTheDocument();
    expect(list.querySelectorAll('[data-status]').length).toBeGreaterThan(0);
  });

  it('keeps working after navigation when window.scrollTo returns a Promise (newer Chromium)', async () => {
    const original = window.scrollTo;
    window.scrollTo = (() => Promise.resolve()) as unknown as typeof window.scrollTo;
    try {
      renderApp('/', await makeEnv());
      const nav = screen.getByRole('navigation', { name: 'Main' });
      fireEvent.click(within(nav).getByText('Theory Archive'));
      const cards = await screen.findAllByTestId('theory-card', {}, { timeout: 5000 });
      expect(cards.length).toBeGreaterThan(0);
      fireEvent.click(within(nav).getByText('About'));
      expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    } finally {
      window.scrollTo = original;
    }
  });

  it('global search finds people by description and navigates to the result', async () => {
    renderApp('/', await makeEnv());
    fireEvent.click(screen.getByRole('button', { name: /Search/ }));
    const input = screen.getByRole('combobox', { name: /Search/ });
    fireEvent.change(input, { target: { value: 'canon law' } });
    const hit = await screen.findByRole('option', { name: /Adam Weishaupt/ }, { timeout: 5000 });
    fireEvent.click(hit);
    expect(await screen.findByRole('heading', { name: 'Adam Weishaupt', level: 1 }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Search/ })).not.toBeInTheDocument();
  });

  it('switches the interface language to German and back', async () => {
    renderApp('/', await makeEnv());
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByText('Theory Archive')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'DE' }));
    expect(within(nav).getByText('Theoriearchiv')).toBeInTheDocument();
    expect(localStorage.getItem('ca.locale')).toBe('de');
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(within(nav).getByText('Theory Archive')).toBeInTheDocument();
  });

  it('shows "Currently unavailable!" instead of endless loading when the backend is down', async () => {
    renderApp('/archive', null);
    const notice = await screen.findByTestId('unavailable', {}, { timeout: 15000 });
    expect(notice).toHaveTextContent('Currently unavailable!');
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  }, 20000);

  it('disables submissions and image uploads when Turnstile is not configured', async () => {
    renderApp('/submit', await makeEnv({ FEATURE_TURNSTILE: 'false' }));
    await waitFor(() => expect(screen.getAllByTestId('unavailable').some((n) => /Anti-spam verification has not been configured/.test(n.textContent ?? ''))).toBe(true), { timeout: 5000 });
    expect(screen.getByTestId('upload-input')).toBeDisabled();
  });

  it('offers the image picker when uploads are available', async () => {
    renderApp('/submit', await makeEnv({ FEATURE_COMMUNITY_UPLOADS: 'true' }));
    await waitFor(() => expect(screen.getByTestId('upload-input')).toBeEnabled(), { timeout: 5000 });
    expect(screen.getByTestId('upload-input')).toHaveAttribute('accept', 'image/*');
  });

  it('shows the exact notice when image uploads are switched off', async () => {
    renderApp('/submit', await makeEnv({ FEATURE_COMMUNITY_UPLOADS: 'false' }));
    await waitFor(() => expect(screen.getAllByTestId('unavailable').some((n) => /File storage is intentionally disabled/.test(n.textContent ?? ''))).toBe(true), { timeout: 5000 });
    expect(screen.getByTestId('upload-input')).toBeDisabled();
  });

  it('admin login is unavailable without configuration', async () => {
    renderApp('/admin', await makeEnv({ ADMIN_PASSWORD_HASH: undefined }));
    const notice = await screen.findByTestId('unavailable', {}, { timeout: 5000 });
    expect(notice).toHaveTextContent('Currently unavailable!');
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it('keeps the English status text and adds a German explanation', () => {
    render(
      <I18nProvider initial="de">
        <Unavailable feature="turnstile" state="not_configured" />
      </I18nProvider>,
    );
    const n = screen.getByTestId('unavailable');
    expect(n).toHaveTextContent('Currently unavailable!');
    expect(n).toHaveTextContent('Anti-spam verification has not been configured.');
    expect(n).toHaveTextContent('Die Anti-Spam-Prüfung (Turnstile) ist nicht eingerichtet.');
  });

  it('never contacts a host other than the own API', async () => {
    const { calls } = renderApp('/', await makeEnv());
    await screen.findAllByTestId('theory-card', {}, { timeout: 5000 });
    expect(calls.every((c) => c.startsWith('/api/'))).toBe(true);
  });
});
