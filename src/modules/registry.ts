import type { AdminModule } from './types';
import { exercisesModule } from './exercises/module';
import { musclesModule } from './muscles/module';
import { variationsModule } from './variations/module';
import { recipesModule } from './recipes/module';
import { splitsModule } from './splits/module';
import { goalsModule } from './goals/module';
import { coverageModule } from './coverage/module';
import { previewModule } from './preview/module';
import { creatorsModule } from './creators/module';
import { moderationModule } from './moderation/module';

// The one place new sections are registered. Order = sidebar order.
export const modules: AdminModule[] = [
  exercisesModule,
  musclesModule,
  variationsModule,
  recipesModule,
  splitsModule,
  goalsModule,
  coverageModule,
  creatorsModule,
  moderationModule,
  previewModule,
  // future: onboardingModule, notificationsModule, featureFlagsModule, …
];
