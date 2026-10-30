// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { cleanup, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { renderApp } from './harness';
import { makeEnv } from '../helpers/app';
import { Unavailable } from '../../src/components/Unavailable';
import { I18nProvider } from '../../src/i18n';
import { render } from '@testing-library/react';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => cleanup());

describe('frontend', () => {
  it('renders the archive from the API', async () => {
    renderApp('/archive', await makeEnv());
    const cards = await screen.findAllByTestId('theory-card', {}, { timeout: 5000 });
    expect(cards).toHaveLength(8);
    expect(screen.getByText('Operation Northwoods')).toBeInTheDocument();
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

  it('disables submissions when Turnstile is not configured and never offers uploads', async () => {
    renderApp('/submit', await makeEnv({ FEATURE_TURNSTILE: 'false' }));
    await waitFor(() => expect(screen.getAllByTestId('unavailable').some((n) => /Anti-spam verification has not been configured/.test(n.textContent ?? ''))).toBe(true), { timeout: 5000 });
    expect(screen.getByTestId('upload-button')).toBeDisabled();
    expect(screen.getAllByTestId('unavailable').some((n) => /File storage is intentionally disabled/.test(n.textContent ?? ''))).toBe(true);
  });

  it('keeps the upload button disabled even when everything else works', async () => {
    renderApp('/submit', await makeEnv());
    await screen.findByTestId('upload-button', {}, { timeout: 5000 });
    expect(screen.getByTestId('upload-button')).toBeDisabled();
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
