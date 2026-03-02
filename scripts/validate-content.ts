import { scenarios } from '@wargames/content';
import { validateBeatGraphs } from '@wargames/engine';

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

console.log(`Validation summary: ${errorCount} error(s), ${warningCount} warning(s).`);

if (errorCount > 0) {
  process.exit(1);
}
