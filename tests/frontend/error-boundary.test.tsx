// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { I18nProvider } from '../../src/i18n';

afterEach(() => cleanup());

function Broken(): never {
  throw new Error('boom');
}

function Shell() {
  const { pathname } = useLocation();
  return (
    <>
      <Link to="/ok">go</Link>
      <ErrorBoundary key={pathname}>
        <Routes>
          <Route path="/broken" element={<Broken />} />
          <Route path="/ok" element={<p>fine</p>} />
        </Routes>
      </ErrorBoundary>
    </>
  );
}

describe('ErrorBoundary', () => {
  it('shows a notice instead of a blank page and recovers on navigation', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <I18nProvider initial="en">
        <MemoryRouter initialEntries={['/broken']}>
          <Shell />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(screen.getByTestId('crash-notice')).toHaveTextContent('This page ran into an error');
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('go'));
    expect(screen.queryByTestId('crash-notice')).not.toBeInTheDocument();
    expect(screen.getByText('fine')).toBeInTheDocument();
    spy.mockRestore();
  });
});
