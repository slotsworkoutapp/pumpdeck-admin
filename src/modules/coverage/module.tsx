import type { AdminModule } from '../types';
import Coverage from './Coverage';

export const coverageModule: AdminModule = {
  id: 'coverage',
  label: 'Coverage',
  icon: <GridIcon />,
  routes: [{ element: <Coverage /> }],
};

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
