import type { AdminModule } from '../types';
import RecipesList from './RecipesList';
import RecipeEditor from './RecipeEditor';

export const recipesModule: AdminModule = {
  id: 'recipes',
  label: 'Day recipes',
  icon: <ClipboardIcon />,
  routes: [
    { element: <RecipesList /> },
    { path: 'new', element: <RecipeEditor /> },
    { path: ':id', element: <RecipeEditor /> },
  ],
};

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 9h6M9 13h6M9 17h4" strokeLinecap="round" />
    </svg>
  );
}
