// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderRoot } from './harness';
import { makeEnv } from '../helpers/app';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('language URLs in the browser', () => {
  it('shows the German version under /de and keeps links in German', async () => {
    const { calls } = renderRoot('/de/archive', await makeEnv());
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const archive = within(nav).getByText('Theoriearchiv').closest('a')!;
    expect(archive.getAttribute('href')).toBe('/de/archive');
    expect(document.documentElement.lang).toBe('de');
    await screen.findAllByTestId('theory-card', {}, { timeout: 5000 });
    expect(calls.some((c) => c.startsWith('/api/theories') && c.includes('lang=de'))).toBe(true);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${window.location.origin}/de/archive`);
  });

  it('switches language by moving to the other URL, and back with the browser', async () => {
    renderRoot('/archive', await makeEnv());
    expect(screen.getByRole('link', { name: 'DE' }).getAttribute('href')).toBe('/de/archive');
    fireEvent.click(screen.getByRole('link', { name: 'DE' }));
    expect(window.location.pathname).toBe('/de/archive');
    expect(screen.getByRole('link', { name: 'EN' }).getAttribute('href')).toBe('/archive');
    expect(localStorage.getItem('ca.locale')).toBe('de');
    act(() => {
      window.history.replaceState(null, '', '/archive');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByText('Theory Archive')).toBeInTheDocument();
  });

  it('turns old ?lang=de links into the German URL', async () => {
    renderRoot('/map?lang=de', await makeEnv());
    expect(window.location.pathname + window.location.search).toBe('/de/map');
  });
});
