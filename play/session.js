import {createClient} from './core/client.js';
// This port exposes authorized packets and commands, never authentication tokens.
export const client=createClient();
