import {describe,expect,it} from "vitest";
import type {Papel,FinalidadeAtendimentoWhatsApp} from "@prisma/client";
const tarefa:{responsavelId:string|null;setor:FinalidadeAtendimentoWhatsApp;gerenteDoResponsavelId:string|null}={responsavelId:'dono',setor:'COMERCIAL' as FinalidadeAtendimentoWhatsApp,gerenteDoResponsavelId:'gc'};
async function pode(papeis:Papel[],extra:{id?:string;ativo?:boolean;tarefa?:typeof tarefa}={}){const m=await import('./tarefa-notificados-regras').catch(()=>({})) as Record<string,unknown>;expect(m.candidatoPodeLerTarefaD10).toBeTypeOf('function');return (m.candidatoPodeLerTarefaD10 as (u:unknown,t:unknown)=>boolean)({id:extra.id??'u',nome:'Fictício',papeis,ativo:extra.ativo??true},extra.tarefa??tarefa);}
describe('candidatos D10 — paridade lógica da ACL própria, sem grant',()=>{
 it('responsável com tarefas.ver lê mesmo fora do setor padrão',async()=>expect(await pode(['VENDEDOR'],{id:'dono',tarefa:{...tarefa,setor:'SECRETARIA'}})).toBe(true));
 it('Vendedor não lê tarefa de colega só por compartilhar setor',async()=>expect(await pode(['VENDEDOR'])).toBe(false));
 it('fila do próprio setor é visível',async()=>expect(await pode(['VENDEDOR'],{tarefa:{...tarefa,responsavelId:null}})).toBe(true));
 it('fila de outro setor não é visível',async()=>expect(await pode(['FINANCEIRO'],{tarefa:{...tarefa,responsavelId:null}})).toBe(false));
 it('Gerente Comercial lê tarefa da própria equipe',async()=>expect(await pode(['GERENTE_COMERCIAL'],{id:'gc'})).toBe(true));
 it('Gerente de outra equipe não lê',async()=>expect(await pode(['GERENTE_COMERCIAL'],{id:'outro'})).toBe(false));
 it('Admin ativo lê qualquer tarefa',async()=>expect(await pode(['ADMINISTRADOR'])).toBe(true));
 it.each([{papeis:['PROFESSOR'] as Papel[]},{papeis:['ALUNO'] as Papel[]},{papeis:[] as Papel[]}])('papel%j não ganha leitura por ser selecionado',async ({papeis})=>expect(await pode(papeis,{id:'dono'})).toBe(false));
 it('usuário inativo não recebe nem quando Admin',async()=>expect(await pode(['ADMINISTRADOR'],{ativo:false})).toBe(false));
 it('identidade vazia não recebe',async()=>expect(await pode(['ADMINISTRADOR'],{id:''})).toBe(false));
 it('papel misto ALUNO+VENDEDOR mantém a regra canônica',async()=>expect(await pode(['ALUNO','VENDEDOR'],{id:'dono'})).toBe(true));
 it('Financeiro responsável recebe sem permissão de Lead',async()=>expect(await pode(['FINANCEIRO'],{id:'dono'})).toBe(true));
});
it('gerente sem responsável real não concede equipe a uma fila de outro setor',async()=>expect(await pode(['GERENTE_COMERCIAL'],{id:'gc',tarefa:{responsavelId:null,setor:'SECRETARIA',gerenteDoResponsavelId:'gc'}})).toBe(false));