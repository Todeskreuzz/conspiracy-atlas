import { useT } from '../i18n';
import { saveCase, unsaveCase, useSaved, type SavedCase } from '../saved/store';

export function SaveButton({ theory, small }: { theory: Omit<SavedCase, 'savedAt'>; small?: boolean }) {
  const t = useT();
  const saved = useSaved().some((c) => c.id === theory.id);
  return (
    <button
      type="button"
      className={`btn${small ? ' btn--small' : ''}${saved ? ' btn--primary' : ''}`}
      aria-pressed={saved}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (saved) unsaveCase(theory.id);
        else saveCase(theory);
      }}
    >
      {saved ? `★ ${t('saved.saved')}` : `☆ ${t('saved.save')}`}
    </button>
  );
}
