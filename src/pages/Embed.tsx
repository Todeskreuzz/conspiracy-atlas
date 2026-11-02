import { CaseOfTheDay } from '../components/CaseOfTheDay';

/** Compact case-of-the-day card for other websites (shown inside an iframe, without the site header). */
export default function EmbedPage() {
  return (
    <div style={{ padding: 12, maxWidth: 640 }}>
      <CaseOfTheDay variant="embed" />
    </div>
  );
}
