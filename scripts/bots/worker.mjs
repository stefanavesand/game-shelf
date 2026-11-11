import {parentPort,workerData} from 'node:worker_threads';
import {runMatch} from './match.mjs';
parentPort.postMessage(runMatch(workerData));
