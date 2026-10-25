import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async original => {
  const real = await original<typeof import("@/server/_shared/sessao")>();
  return { ...real, exigirSessao: async () => {
    const u = await real.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new real.ErroAutenticacao();
    return u;
  } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarAlunoMinimo, criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { vincularContatoWhatsApp } from "@/server/whatsapp/acoes";

beforeEach(async () => { await truncarBanco(); sessao.usuarioId = ""; });
afterEach(() => vi.restoreAllMocks());
afterAll(() => prisma.$disconnect());

it.each(["aluno","responsavel"] as const)("ação pública preserva vínculo legado de %s",async tipo=>{
 const admin=await criarUsuario([Papel.ADMINISTRADOR]);sessao.usuarioId=admin.id;
 const aluno=await criarAlunoMinimo({telefoneE164:"+55000329999"});
 const numero=await criarNumeroSetor({telefoneE164:"+55000329998",setores:["SECRETARIA"]});
 const contato=await prisma.contatoWhatsApp.create({data:{telefoneE164:aluno.telefoneE164!}});
 const a=await prisma.$transaction(tx=>garantirAtendimento(tx,{numeroId:numero.id,contatoId:contato.id,finalidade:"SECRETARIA",alunoId:aluno.id}));
 const id=tipo==="aluno"?aluno.id:(await prisma.responsavel.create({data:{nome:"Responsável fictício329",telefoneE164:aluno.telefoneE164,alunos:{create:{alunoId:aluno.id,papel:"FINANCEIRO"}}}})).id;
 expect((await vincularContatoWhatsApp({contatoId:contato.id,atendimentoId:a.id,alvo:{tipo,id}})).ok).toBe(true);
 const depois=await prisma.contatoWhatsApp.findUniqueOrThrow({where:{id:contato.id}});
 expect(tipo==="aluno"?depois.alunoId:depois.responsavelId).toBe(id);
 expect(await prisma.evento.count({where:{tipo:"ContatoVinculado",agregadoId:contato.id}})).toBe(1);
});