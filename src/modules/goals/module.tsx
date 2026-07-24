import type { AdminModule } from '../types';
import GoalsList from './GoalsList';
import GoalEditor from './GoalEditor';

export const goalsModule: AdminModule = {
  id: 'goals',
  label: 'Goals',
  icon: <TargetIcon />,
  routes: [
    { element: <GoalsList /> },
    { path: ':key', element: <GoalEditor /> },
  ],
};

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}
