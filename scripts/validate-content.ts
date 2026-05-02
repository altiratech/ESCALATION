import actionNarrativesData from '../packages/content/data/action_narratives_ns.json';
import { actions, scenarios } from '@wargames/content';
import { validateBeatGraphs } from '@wargames/engine';
import type { ActionNarrativeDefinition, BeatPhase } from '@wargames/shared-types';

const analyses = validateBeatGraphs(scenarios);

let errorCount = 0;
let warningCount = 0;

for (const analysis of analyses) {
  const errors = analysis.issues.filter((issue) => issue.level === 'error');
  const warnings = analysis.issues.filter((issue) => issue.level === 'warning');
  errorCount += errors.length;
  warningCount += warnings.length;

  console.log(`Scenario: ${analysis.scenarioId}`);
  console.log(`  Beats: ${analysis.beatCount}`);
  console.log(`  Reachable: ${analysis.reachableBeatIds.length}`);
  console.log(`  Terminals: ${analysis.terminalBeatIds.length}`);

  for (const issue of analysis.issues) {
    const location = issue.beatId ? `(${issue.beatId})` : '';
    console.log(`  [${issue.level.toUpperCase()}] ${location} ${issue.message}`.trim());
  }
}

const activeScenarioIds = new Set(scenarios.filter((scenario) => !scenario.isLegacy).map((scenario) => scenario.id));
const allScenarioIds = new Set(scenarios.map((scenario) => scenario.id));
const playerActionIds = new Set(actions.filter((action) => action.actor === 'player').map((action) => action.id));
const requiredActionNarrativePhases: BeatPhase[] = ['opening', 'rising', 'crisis', 'climax'];
const actionNarrativesPack = actionNarrativesData as {
  scenarioId?: string;
  actions?: ActionNarrativeDefinition[];
};

const recordError = (message: string): void => {
  errorCount += 1;
  console.log(`[ERROR] ${message}`);
};

if (!actionNarrativesPack.scenarioId) {
  recordError('Action narratives pack is missing scenarioId.');
} else if (!allScenarioIds.has(actionNarrativesPack.scenarioId)) {
  recordError(`Action narratives pack targets missing scenarioId: ${actionNarrativesPack.scenarioId}`);
} else if (!activeScenarioIds.has(actionNarrativesPack.scenarioId)) {
  recordError(`Action narratives pack targets inactive/legacy scenarioId: ${actionNarrativesPack.scenarioId}`);
}

const actionNarratives = actionNarrativesPack.actions ?? [];
const seenNarrativeActionIds = new Set<string>();
for (const narrative of actionNarratives) {
  if (seenNarrativeActionIds.has(narrative.actionId)) {
    recordError(`Duplicate action narrative id: ${narrative.actionId}`);
  }
  seenNarrativeActionIds.add(narrative.actionId);

  if (!playerActionIds.has(narrative.actionId)) {
    recordError(`Action narrative references missing/non-player actionId: ${narrative.actionId}`);
  }

  for (const phase of requiredActionNarrativePhases) {
    if (!narrative.phases[phase]) {
      recordError(`Action narrative ${narrative.actionId} is missing ${phase} phase content.`);
    }
  }
}

for (const actionId of playerActionIds) {
  if (!seenNarrativeActionIds.has(actionId)) {
    recordError(`Player action is missing action narrative: ${actionId}`);
  }
}

console.log(`Validation summary: ${errorCount} error(s), ${warningCount} warning(s).`);

if (errorCount > 0) {
  process.exit(1);
}
