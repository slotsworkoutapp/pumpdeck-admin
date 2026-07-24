import type { AdminModule } from './types';
import { exercisesModule } from './exercises/module';
import { musclesModule } from './muscles/module';
import { variationsModule } from './variations/module';

// The one place new sections are registered. Order = sidebar order.
export const modules: AdminModule[] = [
  exercisesModule,
  musclesModule,
  variationsModule,
  // future: splitTemplatesModule, onboardingModule,
  //         notificationsModule, featureFlagsModule, …
];
