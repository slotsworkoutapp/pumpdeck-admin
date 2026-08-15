import type { Catalog } from '../../lib/content';

export interface Issue {
  severity: 'error' | 'warning';
  message: string;
  entity: string; // what it's about (exercise/family/muscle name)
}

// The validation report — "make sure everything's correct." Read-only checks
// over the whole catalog.
export function validateCatalog(c: Catalog): Issue[] {
  const issues: Issue[] = [];
  const familyMemberCount = new Map<string, number>();
  const targetedMuscleIds = new Set<string>();

  for (const e of c.exercises) {
    // Every non-cardio exercise needs a home: a primary muscle OR a collection.
    // Burpees and mobility work have no honest primary muscle — the collection
    // is what files them, and demanding a muscle is what mis-filed them before.
    if (e.type_raw !== 'cardio' && !e.primary_muscle_id && !e.collection_id) {
      issues.push({ severity: 'error', entity: e.name, message: 'No primary muscle and no collection — nowhere to file it.' });
    }
    if (e.type_raw === 'cardio' && e.primary_muscle_id) {
      issues.push({ severity: 'warning', entity: e.name, message: 'Cardio exercise has a primary muscle (usually muscle-agnostic).' });
    }
    // Primary muscle must resolve, and must be a real muscle — a collection
    // belongs in `collection_id`, not here.
    if (e.primary_muscle_id && !c.musclesById.has(e.primary_muscle_id)) {
      issues.push({ severity: 'error', entity: e.name, message: 'Primary muscle id does not exist in the catalog.' });
    } else if (e.primary_muscle_id && c.musclesById.get(e.primary_muscle_id)?.group_raw === 'focus') {
      issues.push({
        severity: 'error',
        entity: e.name,
        message: `"${c.musclesById.get(e.primary_muscle_id)!.name}" is a collection, not a muscle — move it to the Collection field.`,
      });
    }
    // Collection must resolve, and must actually be a collection.
    if (e.collection_id) {
      const col = c.musclesById.get(e.collection_id);
      if (!col) {
        issues.push({ severity: 'error', entity: e.name, message: 'Collection id does not exist in the catalog.' });
      } else if (col.group_raw !== 'focus') {
        issues.push({ severity: 'error', entity: e.name, message: `"${col.name}" is a muscle, not a collection.` });
      }
    }
    // Secondary muscles must resolve.
    for (const id of e.secondary_muscle_ids) {
      if (!c.musclesById.has(id)) {
        issues.push({ severity: 'error', entity: e.name, message: `Secondary muscle id ${id.slice(0, 8)}… not in catalog.` });
      } else {
        targetedMuscleIds.add(id);
      }
    }
    if (e.primary_muscle_id) targetedMuscleIds.add(e.primary_muscle_id);
    // Family, if set, must resolve.
    if (e.movement_family_key) {
      if (!c.familiesByKey.has(e.movement_family_key)) {
        issues.push({ severity: 'error', entity: e.name, message: `References unknown family "${e.movement_family_key}".` });
      }
      familyMemberCount.set(e.movement_family_key, (familyMemberCount.get(e.movement_family_key) ?? 0) + 1);
    }
    // Sanity on rest — but cardio and mobility (warm-up/cool-down) are meant to
    // have zero rest, so don't flag those.
    const zeroRestOk = e.type_raw === 'cardio' || e.kind_raw === 'warmup' || e.kind_raw === 'cooldown';
    if (e.default_rest_seconds < 0 || (e.default_rest_seconds === 0 && !zeroRestOk)) {
      issues.push({ severity: 'warning', entity: e.name, message: 'Rest is 0 or negative.' });
    }
    // Untagged equipment is legal (the app shows it to everyone rather than
    // hiding it), but it can't be filtered — so it's the tagging pass's to-do
    // list. A warning, not an error.
    if (!e.equipment) {
      issues.push({ severity: 'warning', entity: e.name, message: 'No equipment tagged — shows for every user, can\'t be filtered.' });
    }
  }

  // A "variation" with fewer than 2 members isn't really a variation.
  for (const f of c.families) {
    // The virtual "group.<x>" families are group slots, not real movement
    // families — they resolve to every exercise in the group at log time, so
    // "no exercises" here is expected, not a problem.
    if (f.key.startsWith('group.')) continue;
    const n = familyMemberCount.get(f.key) ?? 0;
    if (n === 0) {
      issues.push({ severity: 'warning', entity: f.display_name, message: `Family "${f.key}" has no exercises.` });
    } else if (n === 1) {
      issues.push({ severity: 'warning', entity: f.display_name, message: `Family "${f.key}" has only 1 exercise (not a real variation).` });
    }
  }

  // Anatomical muscles that no exercise targets.
  for (const m of c.muscles) {
    if (m.group_raw !== 'focus' && !targetedMuscleIds.has(m.id)) {
      issues.push({ severity: 'warning', entity: m.name, message: 'No exercise targets this muscle.' });
    }
  }

  return issues;
}
