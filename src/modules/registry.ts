import type { AdminModule } from './types';
import { exercisesModule } from './exercises/module';
import { musclesModule } from './muscles/module';
import { variationsModule } from './variations/module';
import { recipesModule } from './recipes/module';
import { splitsModule } from './splits/module';
import { goalsModule } from './goals/module';
import { previewModule } from './preview/module';

// The one place new sections are registered. Order = sidebar order.
export const modules: AdminModule[] = [
  exercisesModule,
  musclesModule,
  variationsModule,
  recipesModule,
  splitsModule,
  goalsModule,
  previewModule,
  // future: onboardingModule, notificationsModule, featureFlagsModule, …
];
