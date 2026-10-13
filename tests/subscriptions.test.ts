import {it,expect} from 'vitest';
import {subscriptionPlan} from '../apps/worker/src/subscriptions';
import {WALLETS} from '../packages/shared/src/index';
import type {Watch} from '../apps/worker/src/watches';
const candidate:Watch={pool:'candidate',mint:'mint',protocol:'pump',signature:'sig',discoveredAt:1,expiresAt:2,kind:'candidate'};
it('free mode subscribes only core wallets and keeps open-position protection',()=>{const p=subscriptionPlan([candidate,{...candidate,pool:'position',kind:'position'}],false,0,0,false);expect(p.addresses).toEqual([...WALLETS,'position']);});
it('opt-in candidate monitoring pauses on either queue pressure or provider cooldown',()=>{for(const [core,pool,cooling] of [[100,0,false],[0,100,false],[0,0,true]] as const)expect(subscriptionPlan([candidate],true,core,pool,cooling).addresses).toEqual(WALLETS);expect(subscriptionPlan([candidate],true,0,0,false).addresses).toContain('candidate');});
