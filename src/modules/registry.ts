import type { AdminModule } from './types';
import { exercisesModule } from './exercises/module';
import { musclesModule } from './muscles/module';
import { variationsModule } from './variations/module';
import { recipesModule } from './recipes/module';

// The one place new sections are registered. Order = sidebar order.
export const modules: AdminModule[] = [
  exercisesModule,
  musclesModule,
  variationsModule,
  recipesModule,
  // future: splitTemplatesModule, onboardingModule,
  //         notificationsModule, featureFlagsModule, …
];
