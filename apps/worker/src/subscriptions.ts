import {WALLETS} from '../../../packages/shared/src/index';
import type {Watch} from './watches';
export function subscriptionPlan(watches:Watch[],candidateEnabled:boolean,corePending:number,poolPending:number,cooling:boolean){
 const reason=!candidateEnabled?'free core-wallet mode':cooling?'RPC cooling down':corePending>=100||poolPending>=100?'durable queue pressure':null;
 return {addresses:[...new Set([...WALLETS,...watches.filter(w=>w.kind==='position'||!reason).map(w=>w.pool)])],candidatePausedReason:reason};
}
