import {it,expect} from 'vitest';
import {analyzeFunding,type Relation} from '../packages/graph/src/index';
const edge=(source:string,target:string,signature:string):Relation=>({id:signature,source,target,signature,time:1,amountLamports:'1',provenance:'LIVE',type:'observed transfer',confidence:'weak'});
it('shows common multilevel funding evidence as suspicion, never confirmed ownership',()=>{
 const rows=[edge('parent','middle','tx1'),edge('middle','A','tx2'),edge('parent','B','tx3')];const r=analyzeFunding(rows,['A','B'],[]);expect(r.suspects[0].ancestor).toBe('parent');expect(r.suspects[0].evidenceSignatures.sort()).toEqual(['tx1','tx2','tx3']);expect(r.suspects[0].sameController).toBe(false);expect(r.suspects[0].status).toBe('suspected');expect(analyzeFunding(rows,['A','B'],['parent']).suspects).toHaveLength(0);
});
