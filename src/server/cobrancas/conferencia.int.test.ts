import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Papel } from "@prisma/client";

const { authMock, enviarMock } = vi.hoisted(() => ({ authMock: vi.fn(), enviarMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/whatsapp/drivers/meta-cloud", () => ({ driverMetaCloud: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
vi.mock("@/server/whatsapp/drivers/evolution", () => ({ driverEvolution: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const u = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!u?.ativo) throw new original.ErroAutenticacao();
    return u;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const u = await sessao(); original.exigirPapel(u, ...papeis); return u;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { diasDepois, seedCanal, seedCobranca } from "@/test/integracao-whatsapp";
import { registrarPagamento, conferirPagamento } from "@/server/financeiro/acoes";
import { salvarConfiguracaoOperacional } from "@/server/operacao/acoes";
import { suspensaoPorConferencia, suspensoesPorConferencia } from "./conferencia";
import { listarFilaCobranca } from "./consultas";
import { enfileirarIntencaoCobranca } from "@/server/whatsapp/fila";
import { referenciaDestinoCobranca, snapshotCobranca } from "@/server/whatsapp/elegibilidade";
import { enfileirarCobrancaWhatsApp } from "@/server/whatsapp/acoes";
import { rodarCronRegua } from "@/server/whatsapp/cron";
import { despacharFila } from "@/server/whatsapp/despachante";

const HORA = 3600_000;
let sec: Awaited<ReturnType<typeof criarUsuario>>, fin: typeof sec, adm: typeof sec;
let contexto: Awaited<ReturnType<typeof seedCobranca>>, canal: Awaited<ReturnType<typeof seedCanal>>;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const dadosInforme = (chave: string) => ({ chaveIdempotencia: `informe-conferencia-${chave}`, valorRecebido: 100, forma: "DINHEIRO" as const, dataPagamento: "2026-09-08" });
async function informar(chave: string) {
  entrar(sec.id);
  const r = await registrarPagamento(contexto.cobranca.id, dadosInforme(chave));
  expect(r.ok, JSON.stringify(r)).toBe(true);
  return prisma.pagamentoInformado.findUniqueOrThrow({ where: { chaveIdempotencia: dadosInforme(chave).chaveIdempotencia } });
}
async function prepararIntencao() {
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: contexto.aluno.telefoneE164!, alunoId: contexto.aluno.id } });
  const cobranca = await prisma.cobranca.findUniqueOrThrow({ where: { id: contexto.cobranca.id } });
  const snapshot = await snapshotCobranca(cobranca.id); if (!snapshot?.destino) throw new Error("Destino ausente na fixture.");
  await prisma.$transaction((tx) => enfileirarIntencaoCobranca(tx, {
    cobrancaId: contexto.cobranca.id, passo: "D-7", numeroId: canal.numero.id, contatoId: contato.id, origem: "CRON", autorId: null,
    referenciaCalendario: { versao: cobranca.versao, vencimento: cobranca.vencimento.toISOString(), cicloRegua: cobranca.cicloRegua },
    referenciaDestino: referenciaDestinoCobranca(snapshot.destino),
    corpoRenderizado: "Lembrete de cobrança autorizado", variaveis: [], templateId: canal.templates.get("amigavel")!, politicaId: canal.politica.id,
  }));
  return prisma.intencaoMensagem.findFirstOrThrow({ where: { cobrancaId: contexto.cobranca.id } });
}

beforeEach(async () => {
  await truncarBanco();
  vi.stubEnv("WHATSAPP_LIVE", "1");
  enviarMock.mockReset().mockImplementation(async () => ({ providerMessageId: `teste-${randomUUID()}` }));
  [sec, fin, adm] = await Promise.all([criarUsuario([Papel.SECRETARIA_ACADEMICA]), criarUsuario([Papel.FINANCEIRO]), criarUsuario([Papel.ADMINISTRADOR])]);
  canal = await seedCanal({ estado: "ATIVA", janela: [0, 24] });
  contexto = await seedCobranca({ vencimento: diasDepois(new Date(), 7) });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("prazo de conferência do informe", () => {
  it("fila usa a turma do contrato cobrado e não a de outra contratação do aluno", async () => {
    const m = await prisma.matricula.findUniqueOrThrow({ where: { id: contexto.matricula.id }, include: { produto: true } });
    const nivel = await prisma.nivel.create({ data: { idiomaId: m.produto.idiomaId, codigo: "A1", ordem: 1 } });
    const turma = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: m.produto.modalidadeId } });
    const outra = await prisma.matricula.create({ data: { alunoId: m.alunoId, produtoId: m.produtoId, paisId: m.paisId, moeda: m.moeda } });
    const alocacao = await prisma.alocacaoTurma.create({ data: { alunoId: m.alunoId, matriculaId: outra.id, turmaId: turma.id } });
    expect((await listarFilaCobranca()).itens.find((c) => c.id === contexto.cobranca.id)?.turma).toBeNull();
    await prisma.alocacaoTurma.update({ where: { id: alocacao.id }, data: { matriculaId: m.id } });
    const modalidade = await prisma.modalidade.findUniqueOrThrow({ where: { id: m.produto.modalidadeId } });
    expect((await listarFilaCobranca()).itens.find((c) => c.id === contexto.cobranca.id)?.turma).toBe(`${modalidade.nome} A1`);
  });

  it("default de 48h é congelado no informe; replay não estende prazo e configuração só altera novos", async () => {
    const primeiro = await informar("primeiro");
    expect(primeiro.suspenderLembretesAte!.getTime() - primeiro.criadoEm.getTime()).toBe(48 * HORA);
    expect(primeiro.status).toBe("A_CONFERIR");
    entrar(adm.id);
    expect((await salvarConfiguracaoOperacional({ exigirPrimeiraMensalidade: false, prazoConferenciaHoras: 72 })).ok).toBe(true);
    entrar(sec.id);
    expect((await registrarPagamento(contexto.cobranca.id, dadosInforme("primeiro"))).ok).toBe(true);
    const replay = await prisma.pagamentoInformado.findUniqueOrThrow({ where: { id: primeiro.id } });
    expect(replay.criadoEm).toEqual(primeiro.criadoEm); expect(replay.suspenderLembretesAte).toEqual(primeiro.suspenderLembretesAte);
    const novo = await informar("novo");
    expect(novo.suspenderLembretesAte!.getTime() - novo.criadoEm.getTime()).toBe(72 * HORA);
    expect(await prisma.pagamentoInformado.count()).toBe(2);
    expect((await eventosDo("Cobranca", contexto.cobranca.id)).filter((e) => e.tipo === "PagamentoInformado")).toHaveLength(2);
    expect(await prisma.recebimento.count()).toBe(0);
  });

  it("só a cobrança relacionada fica suspensa, mesmo havendo outras parcelas da mesma matrícula", async () => {
    const outra = await prisma.cobranca.create({ data: { matriculaId: contexto.matricula.id, tipo: "MENSALIDADE", valorOriginal: 1000, valorNegociado: 1000, moeda: "CRC", vencimento: contexto.cobranca.vencimento } });
    const informe = await informar("escopo");
    const suspensoes = await suspensoesPorConferencia([contexto.cobranca.id, outra.id]);
    expect([...suspensoes.keys()]).toEqual([contexto.cobranca.id]);
    expect(suspensoes.get(contexto.cobranca.id)).toEqual(informe.suspenderLembretesAte);
    const fila = await listarFilaCobranca();
    expect(fila.itens.find((c) => c.id === contexto.cobranca.id)).toMatchObject({ estado: "em_conferencia", passo: null, conferenciaAte: informe.suspenderLembretesAte!.toISOString() });
    expect(fila.itens.find((c) => c.id === outra.id)?.estado).toBe("acao_devida");
    entrar(fin.id);
    expect((await enfileirarCobrancaWhatsApp(contexto.cobranca.id)).ok).toBe(false);
    const cron = await rodarCronRegua();
    expect(cron.enfileiradas).toBe(1); expect(cron.despacho?.despachadas).toBe(1);
    const intencoes = await prisma.intencaoMensagem.findMany();
    expect(intencoes.map((i) => i.cobrancaId)).toEqual([outra.id]);
    expect(enviarMock).toHaveBeenCalledTimes(1);
  });

  it("rejeição e término do prazo removem suspensão sem baixar cobrança nem descartar evidência", async () => {
    const informe = await informar("rejeicao");
    entrar(fin.id);
    expect((await conferirPagamento(informe.id, { versao: informe.versao, confirmar: false, motivo: "Pagamento não localizado" })).ok).toBe(true);
    expect(await suspensaoPorConferencia(contexto.cobranca.id)).toBeNull();
    const outro = await informar("prazo");
    expect(await suspensaoPorConferencia(contexto.cobranca.id, new Date(outro.suspenderLembretesAte!.getTime() - 1))).toEqual(outro.suspenderLembretesAte);
    expect(await suspensaoPorConferencia(contexto.cobranca.id, outro.suspenderLembretesAte!)).toBeNull();
    expect((await prisma.pagamentoInformado.findUniqueOrThrow({ where: { id: outro.id } })).status).toBe("A_CONFERIR");
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: contexto.cobranca.id } })).valorRecebido).toBeNull();
    expect(await prisma.recebimento.count()).toBe(0);
  });
});

describe("régua e despachante revalidam a conferência", () => {
  it("intenção anterior ao informe é adiada até o prazo; rejeição libera o próximo despacho imediatamente", async () => {
    const intencao = await prepararIntencao();
    const informe = await informar("ja-enfileirada");
    const r = await despacharFila();
    expect(r.adiadas).toBe(1); expect(enviarMock).not.toHaveBeenCalled();
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id } })).toMatchObject({ status: "ADIADA", motivoFalha: "comprovante_em_conferencia", despacharAposEm: informe.suspenderLembretesAte });
    entrar(fin.id);
    expect((await conferirPagamento(informe.id, { versao: informe.versao, confirmar: false, motivo: "Evidência rejeitada na conferência" })).ok).toBe(true);
    const retomada = await despacharFila();
    expect(retomada.despachadas).toBe(1); expect(enviarMock).toHaveBeenCalledTimes(1);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id } })).status).toBe("DESPACHADA");
  });

  it("após rejeitar um informe, outro pendente mantém a suspensão e determina o prazo restante", async () => {
    const intencao = await prepararIntencao();
    const primeiro = await informar("48h");
    entrar(adm.id); await salvarConfiguracaoOperacional({ exigirPrimeiraMensalidade: false, prazoConferenciaHoras: 72 });
    const segundo = await informar("72h");
    expect(await suspensaoPorConferencia(contexto.cobranca.id)).toEqual(segundo.suspenderLembretesAte);
    await despacharFila();
    entrar(fin.id); await conferirPagamento(segundo.id, { versao: segundo.versao, confirmar: false, motivo: "Segundo comprovante duplicado" });
    const r = await despacharFila();
    expect(r.adiadas).toBe(1); expect(enviarMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id } })).despacharAposEm).toEqual(primeiro.suspenderLembretesAte);
  });

  it("prazo vencido libera intenção sem exigir rejeição artificial do informe", async () => {
    const intencao = await prepararIntencao();
    const informe = await informar("expira");
    await despacharFila(); expect(enviarMock).not.toHaveBeenCalled();
    const r = await despacharFila(informe.suspenderLembretesAte!);
    expect(r.despachadas).toBe(1); expect(enviarMock).toHaveBeenCalledTimes(1);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id } })).status).toBe("DESPACHADA");
    expect((await prisma.pagamentoInformado.findUniqueOrThrow({ where: { id: informe.id } })).status).toBe("A_CONFERIR");
  });

  it("informe recebido após o claim também impede chamar o driver", async () => {
    const intencao = await prepararIntencao();
    const original = prisma.intencaoMensagem.updateMany.bind(prisma.intencaoMensagem);
    vi.spyOn(prisma.intencaoMensagem, "updateMany").mockImplementation((args) => {
      const resultado = original(args);
      if (args?.data.status !== "ENVIANDO") return resultado;
      return resultado.then(async (alterado) => { await informar("durante-claim"); return alterado; }) as typeof resultado;
    });
    const r = await despacharFila();
    expect(r.adiadas).toBe(1); expect(enviarMock).not.toHaveBeenCalled();
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id } })).toMatchObject({ status: "ADIADA", motivoFalha: "comprovante_em_conferencia" });
  });
});
