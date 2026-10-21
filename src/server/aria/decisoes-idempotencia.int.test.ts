import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166, 7º lote: decisões da Aria idempotentes por natureza. O reenvio de quem já aprovou, rejeitou ou desfez uma ação,
// e de quem já pausou ou reativou a Aria, devolve ok sem efetivar a ação de novo (a resposta ao contato não sai duas
// vezes) nem gravar outro Evento. A linha travada serializa o clique duplo. Se o estado veio de outra pessoa, a ação
// segue recusada como antes. Os casos sequenciais estão também em `historico.int.test.ts` e `estado.int.test.ts`;
// aqui ficam os simultâneos, com a sessão substituída (o import dinâmico do Auth.js não aguenta chamadas paralelas).

const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  const exigirSessao = async () => {
    const u = await o.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new o.ErroAutenticacao();
    return u;
  };
  return { ...o, exigirSessao, exigirSessaoComPapel: async (...papeis: Papel[]) => { const u = await exigirSessao(); o.exigirPapel(u, ...papeis); return u; } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { montarContextoTurno } from "./turno/contexto";
import { executarAcaoCrm, executarResposta } from "./turno/executor";
import { aprovarAcaoAria, desfazerAcaoAria, rejeitarAcaoAria } from "./historico";
import { pausarAria, reativarAria } from "./estado";

const entrar = (id: string) => { sessao.usuarioId = id; };
const eventos = (tipo: string) => prisma.evento.count({ where: { tipo } });

async function cenario() {
  const cat = await seedCatalogoMinimo();
  const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const dono = await criarUsuario([Papel.VENDEDOR]);
  await prisma.usuario.update({ where: { id: dono.id }, data: { gerenteComercialId: gerente.id } });
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const pessoa = await prisma.pessoa.create({ data: { nome: "Maria" } });
  const op = await prisma.oportunidade.create({ data: { nome: "Maria", paisId: cat.pais.id, telefoneE164: "+50688888888", vendedorDonoId: dono.id, pessoaId: pessoa.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688888888", leadId: op.id } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: op.id }));
  const conv = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id }, select: { conversaId: true } });
  const ancora = await prisma.mensagemWhatsApp.create({
    data: { atendimentoId: at.id, conversaId: conv.conversaId, numeroId: numero.id, direcao: "ENTRADA", corpo: "oi", driver: "MOTOR", status: "ENTREGUE", providerMessageId: "idem7-aria" },
  });
  const turno = await prisma.turnoAgenteIA.create({ data: { ancoraMensagemId: ancora.id, atendimentoId: at.id, tipo: "ATENDIMENTO", resultado: "EM_ANDAMENTO" } });
  const tag = await prisma.tag.create({ data: { nome: "Interessado", cor: "INFO" } });
  return { at, turno, tag, pessoa, gerente };
}

let c: Awaited<ReturnType<typeof cenario>>;
beforeEach(async () => {
  await truncarBanco();
  c = await cenario();
  entrar(c.gerente.id);
});

const sugerirTag = () => prisma.$transaction(async (tx) => {
  const ctx = await montarContextoTurno(c.at.id, tx);
  return executarAcaoCrm(tx, { turnoId: c.turno.id, ctx, proposta: { acao: "TAG", tagId: c.tag.id, justificativa: "x" }, destino: "SUGERIR", modo: "SUGERE", simulado: false, confianca: 90 });
});
const executarTag = () => prisma.$transaction(async (tx) => {
  const ctx = await montarContextoTurno(c.at.id, tx);
  return executarAcaoCrm(tx, { turnoId: c.turno.id, ctx, proposta: { acao: "TAG", tagId: c.tag.id, justificativa: "x" }, destino: "EXECUTAR", modo: "EXECUTA", simulado: false, confianca: 90 });
});

describe("decisões da Aria em clique duplo (#166)", () => {
  it("aprovar a resposta sugerida duas vezes ao mesmo tempo cria uma intenção de envio e um Evento", async () => {
    const r = await prisma.$transaction(async (tx) => {
      const ctx = await montarContextoTurno(c.at.id, tx);
      return executarResposta(tx, { turnoId: c.turno.id, ctx, texto: "Podemos conversar.", documentoId: null, destino: "SUGERIR", simulado: false, confianca: 70, fontes: [], nomeAria: "Aria" });
    });
    if (!("acao" in r)) throw new Error("bloqueada");
    const [a, b] = await Promise.all([aprovarAcaoAria(r.acao.id), aprovarAcaoAria(r.acao.id)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await aprovarAcaoAria(r.acao.id)).ok).toBe(true);
    expect(await prisma.intencaoMensagem.count()).toBe(1);
    expect(await eventos("AcaoAriaAprovada")).toBe(1);
  });

  it("rejeitar duas vezes ao mesmo tempo, com o mesmo motivo, grava um Evento; outra pessoa segue recusada", async () => {
    const s = await sugerirTag();
    const [a, b] = await Promise.all([rejeitarAcaoAria(s.id, "Não é o momento"), rejeitarAcaoAria(s.id, "Não é o momento")]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect(await eventos("AcaoAriaRejeitada")).toBe(1);
    entrar((await criarUsuario([Papel.ADMINISTRADOR], "Outro admin")).id);
    expect(await rejeitarAcaoAria(s.id, "Não é o momento")).toEqual({ ok: false, erro: "Esta sugestão já foi decidida." });
  });

  it("desfazer duas vezes ao mesmo tempo reverte uma vez", async () => {
    const e = await executarTag();
    const [a, b] = await Promise.all([desfazerAcaoAria(e.id), desfazerAcaoAria(e.id)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect(await eventos("AcaoAriaDesfeita")).toBe(1);
    expect(await eventos("TagRemovida")).toBe(1);
  });

  it("pausar e reativar a Aria em clique duplo gravam um Evento cada", async () => {
    const [a, b] = await Promise.all([pausarAria({ motivo: "Campanha nova" }), pausarAria({ motivo: "Campanha nova" })]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    const [r1, r2] = await Promise.all([reativarAria(), reativarAria()]);
    expect([r1.ok, r2.ok], JSON.stringify([r1, r2])).toEqual([true, true]);
    expect(await eventos("AriaPausada")).toBe(1);
    expect(await eventos("AriaReativada")).toBe(1);
  });
});
