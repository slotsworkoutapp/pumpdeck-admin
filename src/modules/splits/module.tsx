import type { AdminModule } from '../types';
import SplitsList from './SplitsList';
import SplitEditor from './SplitEditor';

export const splitsModule: AdminModule = {
  id: 'splits',
  label: 'Splits',
  icon: <CalendarIcon />,
  routes: [
    { element: <SplitsList /> },
    { path: ':key', element: <SplitEditor /> },
  ],
};

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}
