Warning: f was declared with const; use let for reassignable variables.
import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { I18nProvider, useT } from './i18n';
import type { Locale } from '../shared/constants';
import { StatusProvider } from './api/status';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageMeta } from './components/PageMeta';
import { HomePage } from './pages/Home';
import { ArchivePage } from './pages/Archive';
import { TheoryPage } from './pages/Theory';
import { OrganizationsPage, OrganizationPage } from './pages/Organizations';
import { EventsPage, EventPage } from './pages/Events';
import { PersonPage } from './pages/Person';
import { TimelinePage } from './pages/Timeline';
import { CommunityPage } from './pages/Community';
import { KnowledgePage } from './pages/Knowledge';
import { ExpertsPage, ExpertCasePage } from './pages/Experts';
import { AboutPage } from './pages/About';
import { NotFoundPage } from './pages/NotFound';

// Heavy, interactive pages are split into separate chunks (all bundled locally, no CDN).
const WallPage = lazy(() => import('./pages/Wall'));
const MapPage = lazy(() => import('./pages/Map'));
const SubmitPage = lazy(() => import('./pages/Submit'));
const InvestigationsPage = lazy(() => import('./pages/Investigations'));
const InvestigationPage = lazy(() => import('./pages/Investigation'));
const SharedInvestigationPage = lazy(() => import('./pages/SharedInvestigation'));
const AdminPage = lazy(() => import('./pages/Admin'));
const SavedPage = lazy(() => import('./pages/Saved'));
const LoginPage = lazy(() => import('./pages/Login'));
const AccountPage = lazy(() => import('./pages/Account'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const DonatePage = lazy(() => import('./pages/Donate'));
const QuizPage = lazy(() => import('./pages/Quiz'));
const RssPage = lazy(() => import('./pages/Rss'));
const EmbedPage = lazy(() => import('./pages/Embed'));

function ScrollTop() {
  const { pathname } = useLocation();
  // Block body on purpose: newer Chromium returns a Promise from scrollTo, and React would call it as the cleanup.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Fallback() {
  const t = useT();
  return (
    <div className="container page">
      <p className="muted loading">{t('app.loading')}</p>
    </div>
  );
}

export function AppRoutes() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname}>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/wall" element={<WallPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/theory/:slug" element={<TheoryPage />} />
          <Route path="/organizations" element={<OrganizationsPage />} />
          <Route path="/organizations/:slug" element={<OrganizationPage />} />
          <Route path="/people/:slug" element={<PersonPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:slug" element={<EventPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/investigations" element={<InvestigationsPage />} />
          <Route path="/investigations/:id" element={<InvestigationPage />} />
          <Route path="/share/investigation/:token" element={<SharedInvestigationPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/experts" element={<ExpertsPage />} />
          <Route path="/experts/:slug" element={<ExpertCasePage />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/rss" element={<RssPage />} />
          <Route path="/rss-page" element={<RssPage />} />
          <Route path="/embed/case-of-the-day" element={<EmbedPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/donate" element={<DonatePage />} />
          <Route path="/admin/*" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

/** Embeds (/embed/...) are shown inside other sites without the site header and footer. */
function Shell() {
  const { pathname } = useLocation();
  if (/^\/embed(\/|$)/.test(pathname)) return <AppRoutes />;
  return (
    <Layout>
      <AppRoutes />
    </Layout>
  );
}

export function App({ locale, onLocaleChange }: { locale?: Locale; onLocaleChange?: (l: Locale) => void } = {}) {
  return (
    <I18nProvider initial={locale} onLocaleChange={onLocaleChange}>
      <StatusProvider>
        <ScrollTop />
        <PageMeta />
        <Shell />
      </StatusProvider>
    </I18nProvider>
  );
}
