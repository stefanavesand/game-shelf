// Origin: stefanavesand/OpenCatan game/session/catan.ts; see docs/provenance/CATAN_SOURCE.json.
import { createPlayer } from './model.js';
import {scenarioTiles,validateScenario} from './scenarios.js';
import { validCoordinate, validSetupRoads, validSetupSettlements } from './setup.js';
import { getHexVertices, vertexKey, edgeKey, getEdgeVertices } from './geometry.js';
import { applyEconomy, COSTS, createDeck, RESOURCES } from './economy.js';
import { applyTurn, isTurnAction, robberPlacements, victims } from './turn.js';
import { bankRate, bankRates, createBasePorts, validRoads, validSettlements } from './board.js';
import { updateScores, score } from './scoring.js';
import { projectView } from './projection.js';
export { RESOURCES, COSTS, vertexKey, edgeKey, getEdgeVertices, getHexVertices, validSetupSettlements, validRoads, validSettlements, score };
export const CATAN_ENGINE_VERSION = '2.1.0';
export class CatanRuleError extends Error {
}
const reject = (message) => { throw new CatanRuleError(message); };
const empty = () => ({ brick: 0, lumber: 0, ore: 0, grain: 0, wool: 0 });
const resourceFor = { hills: 'brick', forest: 'lumber', mountains: 'ore', fields: 'grain', pasture: 'wool' };
const colors = ['red', 'blue', 'orange', 'green'];
export function newCatan(id, seats, context, scenario) {
    if (typeof id !== 'string' || !id.length || ![3, 4].includes(seats.length) || new Set(seats.map(s => s.id)).size !== seats.length)
        reject('Choose three or four distinct seats.');
    validateScenario(scenario);
    const players = seats.map((s, i) => {
        if (!s.id || typeof s.name !== 'string' || s.name.length > 30 || !['human', 'bot'].includes(s.kind) || !['easy', 'standard'].includes(s.level))
            reject('Invalid player configuration.');
        return createPlayer(s.id, s.name || `Player ${i + 1}`, colors[i], i === 0);
    });
    const order = seats.map(s => s.id);
    for (let i = order.length - 1; i > 0; i--) {
        const j = context.randomInt(i + 1);
        [order[i], order[j]] = [order[j], order[i]];
    }
    const tiles = scenarioTiles(scenario).map(t => ({ ...t, hasPirate: false, isFog: false }));
    const state = {
        game: { phase: 'setup-settlement-1', turn: 0, currentPlayerId: order[0], turnTimeRemaining: 0, turnStartedAt: context.now(), mode: 'base',
            settings: { mode: 'base', playerCount: seats.length, victoryPoints: 10, turnTimer: 0, discardLimit: 7, map: scenario?'random-island':'beginner',...(scenario?{scenario:{id:scenario.id,version:scenario.version}}:{}), friendlyRobber: false, hideBankCards: false },
            lastRoll: null, longestRoad: null, largestArmy: null, developmentDeckCount: 25, bank: { brick: 19, lumber: 19, ore: 19, grain: 19, wool: 19 }, pendingDiscard: [], discardAmounts: {}, devCardPlayedThisTurn: false,
            progressDecks: null, barbarianPosition: 0, barbarianStrength: 0, totalKnightStrength: 0, winnerId: null, finalScores: null, setupPlayerIndex: 0, setupDirection: 'forward', roadBuildingRemaining: 0, yearOfPlentyRemaining: 0,
            setupState: { currentPlacementIndex: 0, lastPlacedSettlement: null, placementsComplete: false, playerPlacements: {} } },
        board: { tiles, buildings: [], roads: [], ports: [], knights: [], robberLocation: tiles.find(t => t.terrain === 'desert').coord, pirateLocation: null, merchantLocation: null },
        players: { players, turnOrder: order }, log: { log: [], chat: [], maxLogEntries: 100, maxChatMessages: 0 },
    };
    state.board.ports = createBasePorts(state);
    if(scenario)state.board.ports=state.board.ports.map((p,i)=>({...p,type:scenario.ports[i],ratio:scenario.ports[i]==='generic'?3:2}));
    return { schemaVersion: 1, engineVersion: CATAN_ENGINE_VERSION, id, revision: 0, state, deck: createDeck(context.randomInt), seats: structuredClone(seats), setupIndex: 0, offer: null, trades: [], history: [] };
}
function resourceBundle(value) {
    if (!value || typeof value !== 'object' || Object.keys(value).some(k => !RESOURCES.includes(k)))
        reject('Invalid trade resources.');
    const input = value, result = empty();
    for (const r of RESOURCES) {
        const n = input[r] ?? 0;
        if (!Number.isSafeInteger(n) || n < 0 || n > 19)
            reject('Invalid trade quantity.');
        result[r] = n;
    }
    if (!Object.values(result).some(n => n > 0))
        reject('Both sides must offer resources.');
    return result;
}
function setup(session, actor, action, context) {
    const state = session.state, index = session.setupIndex, count = session.seats.length, player = state.players.players.find(p => p.id === actor);
    if (state.game.currentPlayerId !== actor)
        reject('Not your turn.');
    const settlement = index % 2 === 0;
    if (settlement) {
        if (action.type !== 'PLACE_SETTLEMENT' || !validCoordinate(action.vertex, ['N', 'S']) || !validSetupSettlements(state).some(v => vertexKey(v) === vertexKey(action.vertex)))
            reject('Choose a legal starting settlement.');
        if (action.type !== 'PLACE_SETTLEMENT')
            return;
        state.board.buildings.push({ id: context.id(), type: 'settlement', playerId: actor, playerColor: player.color, vertex: action.vertex });
        player.settlementsRemaining--;
        state.game.setupState.lastPlacedSettlement = action.vertex;
        if (index >= count * 2)
            for (const tile of state.board.tiles) {
                const resource = resourceFor[tile.terrain];
                if (resource && getHexVertices(tile.coord).some(v => vertexKey(v) === vertexKey(action.vertex))) {
                    player.resources[resource]++;
                    state.game.bank[resource]--;
                }
            }
    }
    else {
        if (action.type !== 'PLACE_ROAD' || !validCoordinate(action.edge, ['NE', 'E', 'SE']) || !validSetupRoads(state).some(e => edgeKey(e) === edgeKey(action.edge)))
            reject('Choose a road next to the new settlement.');
        if (action.type !== 'PLACE_ROAD')
            return;
        state.board.roads.push({ id: context.id(), type: 'road', playerId: actor, playerColor: player.color, edge: action.edge });
        player.roadsRemaining--;
        state.game.setupState.lastPlacedSettlement = null;
    }
    session.setupIndex++;
    if (session.setupIndex === count * 4) {
        state.game.setupState = null;
        state.game.phase = 'roll';
        state.game.turn = 1;
        state.game.currentPlayerId = state.players.turnOrder[0];
    }
    else {
        const placement = Math.floor(session.setupIndex / 2), orderIndex = placement < count ? placement : count * 2 - 1 - placement;
        state.game.currentPlayerId = state.players.turnOrder[orderIndex];
        state.game.phase = `${session.setupIndex % 2 ? 'setup-road' : 'setup-settlement'}-${session.setupIndex < count * 2 ? 1 : 2}`;
        state.game.setupState.currentPlacementIndex = placement;
    }
    updateScores(state);
}
// Public offer state is persisted so polling/reload cannot lose immediate bot replies.
export const tradeRecipients = offer => offer ? (offer.recipients ?? [offer.to]) : [];
export const pendingTradeRecipients = offer => tradeRecipients(offer).filter(id => !offer.responses?.[id]);
function recordTrade(session, offer, status = 'waiting', by = null) {
    const entry = {...structuredClone(offer), status, by, revision: session.revision + 1};
    session.trades = [...(session.trades ?? []).filter(t => t.id !== offer.id), entry].slice(-20);
}
export function applyCatan(input, actor, action, context) {
    if (!input || input.schemaVersion !== 1 || input.engineVersion !== CATAN_ENGINE_VERSION)
        reject('Unsupported game version.');
    if (!input.seats.some(s => s.id === actor))
        reject('You are not a participant.');
    if (!action || typeof action !== 'object' || typeof action.type !== 'string')
        reject('Invalid action.');
    if (input.state.game.phase === 'ended')
        reject('The game has ended.');
    const result = structuredClone(input), state = result.state;
    if (state.game.phase.startsWith('setup-'))
        setup(result, actor, action, context);
    else if (action.type === 'TRADE_OFFER') {
        const active = state.game.currentPlayerId, prior = result.offer;
        const recipients = action.to === 'all' ? input.seats.filter(s => s.id !== actor).map(s => s.id) : [action.to];
        if (state.game.phase !== 'main' || !recipients.length || recipients.some(id => !input.seats.some(s => s.id === id && id !== actor))
            || (actor !== active && (recipients.length !== 1 || recipients[0] !== active)))
            reject('Trades must involve the active player.');
        if (prior && (action.replaces !== prior.id || (actor !== prior.from && !pendingTradeRecipients(prior).includes(actor))))
            reject('Review the pending offer before replacing it.');
        if (!prior && action.replaces) reject('The trade is no longer available.');
        const give = resourceBundle(action.give), receive = resourceBundle(action.receive), from = state.players.players.find(p => p.id === actor);
        if (RESOURCES.some(r => give[r] > from.resources[r] || (give[r] > 0 && receive[r] > 0)))
            reject('You must own the offered resources; a resource cannot be on both sides.');
        if (prior) recordTrade(result, prior, 'replaced', actor);
        result.offer = { id: context.id(), from: actor, to: action.to, recipients, responses: {}, turnPlayerId: active, give, receive };
        recordTrade(result, result.offer);
    }
    else if (['TRADE_ACCEPT', 'TRADE_DECLINE', 'TRADE_CANCEL'].includes(action.type)) {
        const response = action, offer = result.offer;
        if (!offer || response.offerId !== offer.id || state.game.phase !== 'main' || state.game.currentPlayerId !== (offer.turnPlayerId ?? offer.from))
            reject('The trade is no longer available.');
        if (response.type === 'TRADE_CANCEL' ? actor !== offer.from : !pendingTradeRecipients(offer).includes(actor))
            reject('You cannot respond to this trade.');
        if (response.type === 'TRADE_ACCEPT') {
            const from = state.players.players.find(p => p.id === offer.from), to = state.players.players.find(p => p.id === actor);
            if (RESOURCES.some(r => from.resources[r] < offer.give[r] || to.resources[r] < offer.receive[r]))
                reject('A player no longer owns the required resources.');
            for (const r of RESOURCES) {
                from.resources[r] += offer.receive[r] - offer.give[r];
                to.resources[r] += offer.give[r] - offer.receive[r];
            }
            from.totalTradesMade++;
            to.totalTradesMade++;
        }
        offer.responses ??= {};
        if (response.type !== 'TRADE_CANCEL') offer.responses[actor] = response.type === 'TRADE_ACCEPT' ? 'accepted' : 'declined';
        const status = response.type === 'TRADE_CANCEL' ? 'cancelled' : response.type === 'TRADE_ACCEPT' ? 'accepted' : pendingTradeRecipients(offer).length ? 'waiting' : 'declined';
        recordTrade(result, offer, status, actor);
        if (status !== 'waiting') result.offer = null;
    }
    else {
        if (result.offer)
            reject('Respond to or cancel the pending trade first.');
        if (isTurnAction(action)) {
            const outcome = applyTurn(state, action, actor, context.randomInt);
            if (!outcome.success)
                reject('error' in outcome ? outcome.error : 'Invalid turn action.');
            if (outcome.success)
                result.state = outcome.state;
        }
        else {
            const allowed = ['BUILD_ROAD', 'BUILD_SETTLEMENT', 'BUILD_CITY', 'BUY_DEVELOPMENT_CARD', 'BANK_TRADE', 'END_TURN', 'PLAY_KNIGHT', 'PLAY_ROAD_BUILDING', 'PLAY_YEAR_OF_PLENTY', 'PLAY_MONOPOLY'];
            if (!allowed.includes(action.type))
                reject('Unsupported action.');
            const outcome = applyEconomy(state, result.deck, action, actor, context);
            if (!outcome.success)
                reject('error' in outcome ? outcome.error : 'Invalid game action.');
            if (outcome.success) {
                result.state = outcome.state;
                result.deck = outcome.deck;
            }
        }
    }
    result.revision++;
    result.state.log.log = result.state.log.log.slice(-50);
    result.history = [...result.history, { revision: result.revision, playerId: actor, message: action.type.toLowerCase().replaceAll('_', ' ') }].slice(-30);
    return result;
}
function canAfford(resources, cost) { return RESOURCES.every(r => resources[r] >= (cost[r] || 0)); }
export function eligibleActors(session) {
    if (session.state.game.phase === 'ended')
        return [];
    if (session.offer)
        return [...pendingTradeRecipients(session.offer), session.offer.from];
    return session.state.game.phase === 'discard' ? session.state.game.pendingDiscard : [session.state.game.currentPlayerId];
}
function discardChoice(resources, count) {
    const result = empty(), remaining = { ...resources };
    while (count-- > 0) {
        const resource = RESOURCES.reduce((best, r) => remaining[r] > remaining[best] ? r : best, RESOURCES[0]);
        result[resource]++;
        remaining[resource]--;
    }
    return result;
}
// Generate choices from a projected human-equivalent observation, never a full private snapshot.
export function catanChoices(state, actor, offer) {
    const player = state.players.players.find(p => p.id === actor);
    if (!player || state.game.phase === 'ended')
        return [];
    if (offer) {
        if (offer.from === actor)
            return [{ type: 'TRADE_CANCEL', offerId: offer.id }];
        if (!pendingTradeRecipients(offer).includes(actor))
            return [];
        return [{ type: 'TRADE_DECLINE', offerId: offer.id }, ...(canAfford(player.resources, offer.receive) ? [{ type: 'TRADE_ACCEPT', offerId: offer.id }] : [])];
    }
    if (state.game.phase === 'discard')
        return state.game.pendingDiscard.includes(actor) ? [{ type: 'DISCARD_RESOURCES', resources: discardChoice(player.resources, state.game.discardAmounts?.[actor] ?? 0) }] : [];
    if (state.game.currentPlayerId !== actor)
        return [];
    if (state.game.phase.startsWith('setup-settlement'))
        return validSetupSettlements(state).map(vertex => ({ type: 'PLACE_SETTLEMENT', vertex }));
    if (state.game.phase.startsWith('setup-road'))
        return validSetupRoads(state).map(edge => ({ type: 'PLACE_ROAD', edge }));
    if (state.game.phase === 'robber-move')
        return robberPlacements(state, actor).map(hex => ({ type: 'MOVE_ROBBER', hex }));
    if (state.game.phase === 'robber-steal')
        return victims(state, state.board.robberLocation, actor).map(victimId => ({ type: 'STEAL_RESOURCE', victimId }));
    if (state.game.phase === 'road-building')
        return validRoads(state, actor).map(edge => ({ type: 'BUILD_ROAD', edge }));
    const choices = [];
    if (state.game.phase === 'roll')
        choices.push({ type: 'ROLL_DICE' });
    else if (state.game.phase === 'main') {
        choices.push({ type: 'END_TURN' });
        if (player.roadsRemaining > 0 && canAfford(player.resources, COSTS.road))
            choices.push(...validRoads(state, actor).map(edge => ({ type: 'BUILD_ROAD', edge })));
        if (player.settlementsRemaining > 0 && canAfford(player.resources, COSTS.settlement))
            choices.push(...validSettlements(state, actor).map(vertex => ({ type: 'BUILD_SETTLEMENT', vertex })));
        if (player.citiesRemaining > 0 && canAfford(player.resources, COSTS.city))
            choices.push(...state.board.buildings.filter(b => b.playerId === actor && b.type === 'settlement').map(b => ({ type: 'BUILD_CITY', vertex: b.vertex })));
        if (state.game.developmentDeckCount > 0 && canAfford(player.resources, COSTS.development))
            choices.push({ type: 'BUY_DEVELOPMENT_CARD' });
        for (const give of RESOURCES)
            for (const rate of bankRates(state, actor, give))
                if (player.resources[give] >= rate)
                for (const receive of RESOURCES)
                    if (give !== receive && state.game.bank[receive] > 0)
                        choices.push({ type: 'BANK_TRADE', give: { resource: give, amount: rate }, receive: { resource: receive, amount: 1 } });
    }
    else
        return [];
    if (!state.game.devCardPlayedThisTurn && !player.hasPlayedDevCard) {
        const cards = new Set(player.developmentCards.filter(c => !c.isPlayed && c.turnBought !== state.game.turn).map(c => c.type));
        if (cards.has('knight'))
            choices.push({ type: 'PLAY_KNIGHT', hex: state.board.robberLocation });
        if (cards.has('roadBuilding') && player.roadsRemaining > 0 && validRoads(state, actor).length)
            choices.push({ type: 'PLAY_ROAD_BUILDING' });
        if (cards.has('monopoly'))
            choices.push(...RESOURCES.map(resource => ({ type: 'PLAY_MONOPOLY', resource })));
        if (cards.has('yearOfPlenty'))
            for (let i = 0; i < 5; i++)
                for (let j = i; j < 5; j++)
                    if (state.game.bank[RESOURCES[i]] > (i === j ? 1 : 0) && state.game.bank[RESOURCES[j]] > 0)
                        choices.push({ type: 'PLAY_YEAR_OF_PLENTY', resources: [RESOURCES[i], RESOURCES[j]] });
    }
    return choices;
}
export function catanView(session, actor) {
    if (!session.seats.some(s => s.id === actor))
        reject('You are not a participant.');
    const state = structuredClone(projectView(session.state, actor));
    return { apiVersion: 1, engineVersion: session.engineVersion, id: session.id, revision: session.revision, you: actor, state, seats: structuredClone(session.seats), offer: structuredClone(session.offer), trades: structuredClone(session.trades ?? []), history: structuredClone(session.history), choices: catanChoices(state, actor, session.offer) };
}
