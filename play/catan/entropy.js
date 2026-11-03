// Explicit versioned deterministic effects for trusted-friend replicated games.
// Seed comes from the creator's crypto source; future draws are inspectable by participants.
export const RANDOM_ALGORITHM='xorshift32-v1';
export function createEntropy(saved,gameId,logicalTime) {
  const data=structuredClone(saved);
  if(!Number.isSafeInteger(data.rngState)||data.rngState<=0||data.rngState>0xffffffff||!Number.isSafeInteger(data.idCounter)||data.idCounter<0)throw Error('Invalid saved entropy.');
  return {
    randomInt(upper) {
      if(!Number.isSafeInteger(upper)||upper<1||upper>0xffffffff)throw Error('Invalid random bound.');
      // Xorshift32 visits all nonzero uint32 states. Subtract one before bounded rejection.
      const range=0xffffffff,limit=range-range%upper;let draw;
      do {let x=data.rngState;x^=x<<13;x^=x>>>17;x^=x<<5;data.rngState=x>>>0;draw=data.rngState-1;}while(draw>=limit);
      return draw%upper;
    },
    now:()=>logicalTime,
    id:()=>`${gameId}:entity:${++data.idCounter}`,
    snapshot:()=>structuredClone(data)
  };
}
