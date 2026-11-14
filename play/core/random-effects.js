// Side-effect adapter only. Reducers consume recorded outcomes, never browser RNG.
export function secureInteger(upper,cryptoSource=globalThis.crypto){
 if(!Number.isSafeInteger(upper)||upper<1||upper>0x100000000)throw Error('Invalid random bound.');
 const limit=0x100000000-0x100000000%upper,buffer=new Uint32Array(1);let value;
 do{cryptoSource.getRandomValues(buffer);value=buffer[0];}while(value>=limit);
 return value%upper;
}
export function randomEffects(state,command,cryptoSource=globalThis.crypto){
 return state?.diceMode==='host-random-v1'&&command?.action?.type==='ROLL_DICE'?{dice:[secureInteger(6,cryptoSource)+1,secureInteger(6,cryptoSource)+1]}:{};
}
