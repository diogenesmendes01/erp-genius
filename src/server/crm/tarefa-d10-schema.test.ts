import {describe,expect,it} from "vitest";
async function carregar(){return import("./tarefa-d10-schema").catch(()=>({})) as Promise<Record<string,unknown>>;}
async function schema(nome:string){const m=await carregar();expect(m[nome]).toBeDefined();return m[nome] as {parse(v:unknown):unknown;safeParse(v:unknown):{success:boolean}};}
describe("D10 independente — schemas ainda sem porta de runtime",()=>{
 it.each(['BAIXA','NORMAL','ALTA'])('prioridade%s é aceita',async p=>expect((await schema('PrioridadeTarefaD10Schema')).parse(p)).toBe(p));
 it.each(['URGENTE','baixa',null,0])('prioridade inválida%j é recusada',async p=>expect((await schema('PrioridadeTarefaD10Schema')).safeParse(p).success).toBe(false));
 it.each([0,10,15,30,60,1440,null])('lembrete aditivo%j é preservado',async v=>expect((await schema('LembreteTarefaD10Schema')).parse(v)).toBe(v));
 it.each([-1,1,14,16,90,1439,1441,15.5,'15',false])('lembrete inválido%j é recusado',async v=>expect((await schema('LembreteTarefaD10Schema')).safeParse(v).success).toBe(false));
 it('omissão não cria defaults ou limpa seleção',async()=>expect((await schema('CamposAdicionaisTarefaD10Schema')).parse({})).toEqual({}));
 it('lista vazia é clear explícito e não undefined',async()=>expect((await schema('CamposAdicionaisTarefaD10Schema')).parse({notificarUsuarioIds:[]})).toEqual({notificarUsuarioIds:[]}));
 it('normaliza conjunto sem mutar entrada nem reduzir caixa do ID',async()=>{const ids=[' b ','a','b','A'];const s=await schema('CamposAdicionaisTarefaD10Schema');expect(s.parse({notificarUsuarioIds:ids})).toEqual({notificarUsuarioIds:['A','a','b']});expect(ids).toEqual([' b ','a','b','A']);});
 it.each([{ids:null},{ids:['']},{ids:['  ']},{ids:[12]},{ids:[{id:'u'}]}])('seleção inválida%j é recusada',async ({ids})=>expect((await schema('CamposAdicionaisTarefaD10Schema')).safeParse({notificarUsuarioIds:ids}).success).toBe(false));
 it('não aceita autor, papel ou capacidade do browser',async()=>expect((await schema('CamposAdicionaisTarefaD10Schema')).safeParse({autorId:'u',papeis:['ADMINISTRADOR']}).success).toBe(false));
});
it('limite200 é aplicado ao conjunto único sem truncar201',async()=>{
 const s=await schema('CamposAdicionaisTarefaD10Schema');
 const ids=Array.from({length:200},(_,i)=>`colega-${i}`);
 expect(s.parse({notificarUsuarioIds:[...ids,...ids]})).toEqual({notificarUsuarioIds:[...ids].sort()});
 expect(s.safeParse({notificarUsuarioIds:[...ids,'colega-extra']}).success).toBe(false);
});