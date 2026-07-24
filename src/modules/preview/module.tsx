import type { AdminModule } from '../types';
import Preview from './Preview';

export const previewModule: AdminModule = {
  id: 'preview',
  label: 'Program preview',
  icon: <EyeIcon />,
  routes: [{ element: <Preview /> }],
};

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
