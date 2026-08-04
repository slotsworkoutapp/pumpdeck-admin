import type { AdminModule } from '../types';
import CreatorsList from './CreatorsList';
import CreatorEditor from './CreatorEditor';

export const creatorsModule: AdminModule = {
  id: 'creators',
  label: 'Creators',
  icon: <MegaphoneIcon />,
  routes: [
    { element: <CreatorsList /> },
    { path: 'new', element: <CreatorEditor /> },
    { path: ':id', element: <CreatorEditor /> },
  ],
};

function MegaphoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z" />
      <path d="M14 8a4 4 0 0 1 0 8" />
      <path d="M10 18v1.5a1.5 1.5 0 0 0 3 0V18" />
    </svg>
  );
}
