import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { I18nProvider, useT } from './i18n';
import { StatusProvider } from './api/status';
import { Layout } from './components/Layout';
import { HomePage } from './pages/Home';
import { ArchivePage } from './pages/Archive';
import { TheoryPage } from './pages/Theory';
import { OrganizationsPage, OrganizationPage } from './pages/Organizations';
import { EventsPage, EventPage } from './pages/Events';
import { PersonPage } from './pages/Person';
import { TimelinePage } from './pages/Timeline';
import { CommunityPage } from './pages/Community';
import { KnowledgePage } from './pages/Knowledge';
import { AboutPage } from './pages/About';
import { NotFoundPage } from './pages/NotFound';

// Heavy, interactive pages are split into separate chunks (all bundled locally, no CDN).
const WallPage = lazy(() => import('./pages/Wall'));
const MapPage = lazy(() => import('./pages/Map'));
const SubmitPage = lazy(() => import('./pages/Submit'));
const InvestigationsPage = lazy(() => import('./pages/Investigations'));
const InvestigationPage = lazy(() => import('./pages/Investigation'));
const AdminPage = lazy(() => import('./pages/Admin'));

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
  return (
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
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <I18nProvider>
      <StatusProvider>
        <ScrollTop />
        <Layout>
          <AppRoutes />
        </Layout>
      </StatusProvider>
    </I18nProvider>
  );
}
