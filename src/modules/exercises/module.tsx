import type { AdminModule } from '../types';
import ExercisesList from './ExercisesList';
import ExerciseEditor from './ExerciseEditor';

export const exercisesModule: AdminModule = {
  id: 'exercises',
  label: 'Exercises',
  icon: <DumbbellIcon />,
  routes: [
    { element: <ExercisesList /> },
    { path: 'new', element: <ExerciseEditor /> },
    { path: ':id', element: <ExerciseEditor /> },
  ],
};

function DumbbellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" strokeLinecap="round" />
    </svg>
  );
}
