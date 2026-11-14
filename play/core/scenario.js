import {generateScenario} from '../catan/rules/scenarios.js';
import {secureInteger} from './random-effects.js';
// Host adapter: generate once, then persist the entire board configuration.
export const makeScenario=id=>generateScenario(id,upper=>secureInteger(upper));
