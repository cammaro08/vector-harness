import { ValidationScenario } from '../types';
import allPassScenario from './all-pass';
import singleFailureScenario from './single-failure';
import retryThenPassScenario from './retry-then-pass';
import escalationScenario from './escalation';
import allSkippedScenario from './all-skipped';
import manyChecksScenario from './many-checks';

export const allScenarios: readonly ValidationScenario[] = [
  allPassScenario,
  singleFailureScenario,
  retryThenPassScenario,
  escalationScenario,
  allSkippedScenario,
  manyChecksScenario,
];

export { default as allPass } from './all-pass';
export { default as singleFailure } from './single-failure';
export { default as retryThenPass } from './retry-then-pass';
export { default as escalation } from './escalation';
export { default as allSkipped } from './all-skipped';
export { default as manyChecks } from './many-checks';
