import type { ReactNode } from 'react';

// A route within a module. Omit `path` for the module's landing (index) view.
export interface ModuleRoute {
  path?: string; // relative to /<module id>
  element: ReactNode;
}

// The contract every content section implements. Adding a new section
// (onboarding, notifications, achievements, feature flags, …) means creating a
// folder under src/modules/<name>/ that exports one of these, then adding it to
// the registry. No core changes required.
export interface AdminModule {
  id: string; // stable slug, also the route base, e.g. "exercises"
  label: string; // sidebar label
  icon: ReactNode; // sidebar icon
  routes: ModuleRoute[]; // rendered under /<id>
}
