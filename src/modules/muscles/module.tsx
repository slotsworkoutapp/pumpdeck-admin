import type { AdminModule } from '../types';
import MusclesList from './MusclesList';
import MuscleEditor from './MuscleEditor';

export const musclesModule: AdminModule = {
  id: 'muscles',
  label: 'Muscles',
  icon: <AnatomyIcon />,
  routes: [
    { element: <MusclesList /> },
    { path: 'new', element: <MuscleEditor /> },
    { path: ':id', element: <MuscleEditor /> },
  ],
};

function AnatomyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="5" r="2.4" />
      <path d="M6 21c0-4 2.5-7 6-7s6 3 6 7M8 10l4 2 4-2" strokeLinecap="round" />
    </svg>
  );
}
