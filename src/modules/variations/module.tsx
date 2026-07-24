import type { AdminModule } from '../types';
import VariationsList from './VariationsList';
import VariationEditor from './VariationEditor';

export const variationsModule: AdminModule = {
  id: 'variations',
  label: 'Variations',
  icon: <StackIcon />,
  routes: [
    { element: <VariationsList /> },
    { path: 'new', element: <VariationEditor /> },
    { path: ':key', element: <VariationEditor /> },
  ],
};

function StackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 3 3 8l9 5 9-5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
