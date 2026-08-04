import type { AdminModule } from '../types';
import ReportsList from './ReportsList';

export const moderationModule: AdminModule = {
  id: 'moderation',
  label: 'Moderation',
  icon: <FlagIcon />,
  routes: [{ element: <ReportsList /> }],
};

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 21V4M4 4h11l-1.5 4L15 12H4" />
    </svg>
  );
}
