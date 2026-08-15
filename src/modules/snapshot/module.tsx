import type { AdminModule } from '../types';
import SnapshotPage from './SnapshotPage';

/// Hidden: reached by tapping the sidebar's snapshot pill, not by a nav row of
/// its own. It's a detail view for a status indicator, not a section.
export const snapshotModule: AdminModule = {
  id: 'snapshot',
  label: 'Snapshot',
  icon: null,
  hidden: true,
  routes: [{ element: <SnapshotPage /> }],
};
