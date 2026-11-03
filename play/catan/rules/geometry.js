// Original integer axial topology, derived from pointy-hex geometry.
// No upstream geometry implementation is included. Coordinates match the UI wire contract.
export const HEX_SIZE=60;
const vertex=(q,r,direction)=>({hex:{q,r},direction});
const edge=(q,r,direction)=>({hex:{q,r},direction});
export const vertexKey=v=>`${v.hex.q},${v.hex.r}:${v.direction}`;
export const edgeKey=e=>`${e.hex.q},${e.hex.r}:${e.direction}`;
export function getHexVertices({q,r}) {
  return [vertex(q,r,'N'),vertex(q+1,r-1,'S'),vertex(q,r+1,'N'),vertex(q,r,'S'),vertex(q-1,r+1,'N'),vertex(q,r-1,'S')];
}
export function getHexEdges({q,r}) {
  return [edge(q,r,'NE'),edge(q,r,'E'),edge(q,r,'SE'),edge(q-1,r+1,'NE'),edge(q-1,r,'E'),edge(q,r-1,'SE')];
}
export function getEdgeVertices({hex:{q,r},direction}) {
  switch(direction){
    case 'NE':return [vertex(q,r,'N'),vertex(q+1,r-1,'S')];
    case 'E':return [vertex(q+1,r-1,'S'),vertex(q,r+1,'N')];
    case 'SE':return [vertex(q,r+1,'N'),vertex(q,r,'S')];
    default:throw Error('Unsupported edge direction.');
  }
}
export function getVertexEdges({hex:{q,r},direction}) {
  if(direction==='N')return [edge(q,r,'NE'),edge(q,r-1,'SE'),edge(q,r-1,'E')];
  if(direction==='S')return [edge(q,r,'SE'),edge(q-1,r+1,'NE'),edge(q-1,r+1,'E')];
  throw Error('Unsupported vertex direction.');
}
export function edgeToPixel({hex:{q,r},direction},size=HEX_SIZE) {
  const offsets={NE:[1,-3],E:[2,0],SE:[1,3]},[x,y]=offsets[direction];
  return {x:Math.sqrt(3)*size*(q+r/2+x/4),y:size*(1.5*r+y/4)};
}
