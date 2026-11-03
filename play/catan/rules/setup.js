// Origin: stefanavesand/OpenCatan game/engine/setupValidation.ts; see docs/provenance/CATAN_SOURCE.json.
import { getHexVertices, getHexEdges, getVertexEdges, getEdgeVertices, vertexKey, edgeKey } from './geometry.js';
const unique = (values, key) => [...new Map(values.map(v => [key(v), v])).values()];
export function validSetupSettlements(state) {
    const blocked = new Set();
    for (const building of state.board.buildings) {
        blocked.add(vertexKey(building.vertex));
        for (const edge of getVertexEdges(building.vertex)) {
            for (const vertex of getEdgeVertices(edge))
                blocked.add(vertexKey(vertex));
        }
    }
    return unique(state.board.tiles.filter(t => t.terrain !== 'water')
        .flatMap(tile => getHexVertices(tile.coord)), vertexKey).filter(vertex => !blocked.has(vertexKey(vertex)));
}
export function validSetupRoads(state) {
    const vertex = state.game.setupState?.lastPlacedSettlement;
    if (!vertex)
        return [];
    const landEdges = new Set(state.board.tiles.filter(t => t.terrain !== 'water')
        .flatMap(tile => getHexEdges(tile.coord)).map(edgeKey));
    const occupied = new Set(state.board.roads.map(road => edgeKey(road.edge)));
    return getVertexEdges(vertex).filter(edge => landEdges.has(edgeKey(edge)) && !occupied.has(edgeKey(edge)));
}
export function validCoordinate(value, directions) {
    if (!value || typeof value !== 'object')
        return false;
    const v = value;
    return !!v.hex && Number.isSafeInteger(v.hex.q) && Number.isSafeInteger(v.hex.r) && directions.includes(v.direction ?? '');
}
