import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { registrarRelatoIndisponibilidadeOferta } from "./indisponibilidade-oferta-relato";
import { confirmarRelatoIndisponibilidadeOferta } from "./indisponibilidade-oferta-confirmacao";
import { proporTerminoIndisponibilidadeOferta, decidirTerminoIndisponibilidadeOferta } from "./indisponibilidade-oferta-termino";
import { consultarCorrecoesRelatoIndisponibilidadeOferta, decidirCorrecaoRelatoIndisponibilidadeOferta, proporCorrecaoRelatoIndisponibilidadeOferta } from "./indisponibilidade-oferta-correcao";
import { conferirIndisponibilidadeOfertaTx } from "./indisponibilidade-oferta-estado";
import { apurarDiasIndisponibilidadeCoberturaTx } from "./apuracao-indisponibilidade-cobertura";

let matriculaId: string, secretariaId: string, gestorId: string;
const comoSecretaria = () => authMock.mockResolvedValue({ user: { id: secretariaId } });
const comoGestor = () => authMock.mockResolvedValue({ user: { id: gestorId } });
const estado = (dia: string) => prisma.$transaction(tx => conferirIndisponibilidadeOfertaTx(tx, { matriculaId, inicio: new Date(dia), fim: new Date(dia) }));
const textos = { motivo: "Data informada errada no relato", evidenciaTexto: "Ata da coordenação com a data correta" };
const decidir = (propostaId: string, aprovada = true) => decidirCorrecaoRelatoIndisponibilidadeOferta({ propostaId, aprovada, motivo: "Conferência independente da correção", evidenciaTexto: "Oferta conferida no período corrigido" });

async function relatoConfirmado(inicio: string, fim: string | null, chave: string, confirmar = true) {
  comoSecretaria();
  const relato = await registrarRelatoIndisponibilidadeOferta({ matriculaId, inicio, fim, motivo: "Escola sem turma disponível", evidenciaTexto: "Indisponibilidade registrada para continuidade", chaveIdempotencia: chave });
  if (!relato.ok || !relato.dado) throw new Error(JSON.stringify(relato));
  if (confirmar) {
    comoGestor();
    expect(await confirmarRelatoIndisponibilidadeOferta({ registroId: relato.dado.id, confirmada: true, motivo: "Falta de oferta confirmada", evidenciaTexto: "Gestão conferiu a inexistência de turma" })).toMatchObject({ ok: true });
  }
  comoSecretaria();
  return relato.dado.id;
}

beforeEach(async () => {
  await truncarBanco();
  const c = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Correção", paisId: c.pais.id } });
  matriculaId = (await prisma.matricula.create({ data: { alunoId: aluno.id, paisId: c.pais.id, produtoId: c.produto.id, moeda: "CRC" } })).id;
});

it("aprova correção independente: relato, estado e apuração passam ao período vigente e o histórico preserva o anterior", async () => {
  const registroId = await relatoConfirmado("2026-10-01", "2026-10-10", "relato-correcao-fechado");
  const original = await prisma.registroIndisponibilidadeOfertaMatricula.findUniqueOrThrow({ where: { id: registroId } });
  const entrada = { registroId, inicio: "2026-10-03", fim: "2026-10-12", ...textos, chaveIdempotencia: "correcao-primeira" };
  const p = await proporCorrecaoRelatoIndisponibilidadeOferta(entrada);
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  expect(await proporCorrecaoRelatoIndisponibilidadeOferta(entrada)).toEqual(p);
  expect(p.dado).toMatchObject({ versao: 1, anterior: { inicio: "2026-10-01", fim: "2026-10-10" }, novo: { inicio: "2026-10-03", fim: "2026-10-12" }, decisao: null });
  // Proposta pendente não muda nada.
  expect(await estado("2026-10-01")).toMatchObject({ estado: "INDISPONIVEL" });
  expect(await proporCorrecaoRelatoIndisponibilidadeOferta({ ...entrada, chaveIdempotencia: "correcao-concorrente" })).toMatchObject({ ok: false });
  expect(await decidir(p.dado.id)).toMatchObject({ ok: false }); // secretaria não decide

  comoGestor();
  const d = await decidir(p.dado.id);
  expect(d).toMatchObject({ ok: true, dado: { decisao: { aprovada: true } } });
  expect(await decidir(p.dado.id)).toEqual(d);
  const corrigido = await prisma.registroIndisponibilidadeOfertaMatricula.findUniqueOrThrow({ where: { id: registroId } });
  expect(corrigido).toEqual({ ...original, inicio: new Date("2026-10-03"), fim: new Date("2026-10-12") });
  expect(await estado("2026-10-02")).toMatchObject({ estado: "SEM_RELATO" });
  expect(await estado("2026-10-12")).toMatchObject({ estado: "INDISPONIVEL" });
  const apuracao = await prisma.$transaction(tx => apurarDiasIndisponibilidadeCoberturaTx(tx, { matriculaId, inicio: new Date("2026-10-01"), fim: new Date("2026-10-31") }));
  expect(apuracao.diasConfirmados).toHaveLength(10);
  expect(apuracao.diasConfirmados[0]).toBe("2026-10-03");
  expect(await prisma.cobranca.count()).toBe(0);

  // Segunda versão parte do período já corrigido; o histórico mantém as duas.
  comoSecretaria();
  const p2 = await proporCorrecaoRelatoIndisponibilidadeOferta({ ...entrada, inicio: "2026-10-02", chaveIdempotencia: "correcao-segunda" });
  expect(p2).toMatchObject({ ok: true, dado: { versao: 2, anterior: { inicio: "2026-10-03", fim: "2026-10-12" } } });
  const consulta = await consultarCorrecoesRelatoIndisponibilidadeOferta({ registroId });
  expect(consulta).toMatchObject({ ok: true, dado: { relato: { inicio: "2026-10-03", fim: "2026-10-12" }, podePropor: false, podeDecidir: false, propostas: [{ versao: 2, decisao: null }, { versao: 1, decisao: { aprovada: true } }] } });
});

it("rejeição preserva o relato e libera nova proposta; autoaprovação é negada na ação e no banco", async () => {
  const registroId = await relatoConfirmado("2026-10-01", "2026-10-10", "relato-correcao-rejeicao");
  const p = await proporCorrecaoRelatoIndisponibilidadeOferta({ registroId, inicio: "2026-10-05", fim: "2026-10-10", ...textos, chaveIdempotencia: "correcao-rejeitada" });
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  await prisma.usuario.update({ where: { id: secretariaId }, data: { papeis: ["SECRETARIA_ACADEMICA", "ADMINISTRADOR"] } });
  expect(await decidir(p.dado.id)).toMatchObject({ ok: false });
  await expect(prisma.decisaoCorrecaoRelatoIndisponibilidadeOferta.create({ data: { propostaId: p.dado.id, decisorId: secretariaId, aprovada: true, motivo: "Tentativa do próprio autor", evidenciaTexto: "Evidência de teste para autoaprovação", entradaHash: "a".repeat(64) } })).rejects.toThrow();
  comoGestor();
  expect(await decidir(p.dado.id, false)).toMatchObject({ ok: true, dado: { decisao: { aprovada: false } } });
  expect(await prisma.registroIndisponibilidadeOfertaMatricula.findUniqueOrThrow({ where: { id: registroId } })).toMatchObject({ inicio: new Date("2026-10-01"), fim: new Date("2026-10-10") });
  comoSecretaria();
  expect(await proporCorrecaoRelatoIndisponibilidadeOferta({ registroId, inicio: "2026-10-04", fim: "2026-10-10", ...textos, chaveIdempotencia: "correcao-apos-rejeicao" })).toMatchObject({ ok: true, dado: { versao: 2 } });
});

it("o banco só aceita mudar o período do relato com correção aprovada correspondente", async () => {
  const registroId = await relatoConfirmado("2026-10-01", "2026-10-10", "relato-correcao-guard");
  await expect(prisma.registroIndisponibilidadeOfertaMatricula.update({ where: { id: registroId }, data: { inicio: new Date("2026-10-02") } })).rejects.toThrow();
  const p = await proporCorrecaoRelatoIndisponibilidadeOferta({ registroId, inicio: "2026-10-02", fim: "2026-10-10", ...textos, chaveIdempotencia: "correcao-guard-01" });
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  // Pendente não respalda; aprovada só respalda exatamente o período proposto e nunca outros campos.
  await expect(prisma.registroIndisponibilidadeOfertaMatricula.update({ where: { id: registroId }, data: { inicio: new Date("2026-10-02") } })).rejects.toThrow();
  comoGestor();
  expect(await decidir(p.dado.id)).toMatchObject({ ok: true });
  await expect(prisma.registroIndisponibilidadeOfertaMatricula.update({ where: { id: registroId }, data: { inicio: new Date("2026-10-04") } })).rejects.toThrow();
  await expect(prisma.registroIndisponibilidadeOfertaMatricula.update({ where: { id: registroId }, data: { motivo: "Motivo reescrito indevidamente" } })).rejects.toThrow();
  await expect(prisma.propostaCorrecaoRelatoIndisponibilidadeOferta.update({ where: { id: p.dado.id }, data: { inicioNovo: new Date("2026-10-05") } })).rejects.toThrow();
  await expect(prisma.decisaoCorrecaoRelatoIndisponibilidadeOferta.deleteMany()).rejects.toThrow();
});

it("relato aberto corrige só o início, respeitando o término aprovado; relato não confirmado não admite correção", async () => {
  const aberto = await relatoConfirmado("2026-10-01", null, "relato-correcao-aberto");
  expect(await proporCorrecaoRelatoIndisponibilidadeOferta({ registroId: aberto, inicio: "2026-10-01", fim: "2026-10-08", ...textos, chaveIdempotencia: "correcao-fecha-aberto" })).toMatchObject({ ok: false });
  const termino = await proporTerminoIndisponibilidadeOferta({ registroId: aberto, fim: "2026-10-10", motivo: "Oferta regularizada pela escola", evidenciaTexto: "Gestão conferiu a disponibilidade de continuidade", chaveIdempotencia: "termino-para-correcao" });
  if (!termino.ok || !termino.dado) throw new Error(JSON.stringify(termino));
  comoGestor();
  expect(await decidirTerminoIndisponibilidadeOferta({ propostaId: termino.dado.id, aprovada: true, motivo: "Conferência independente do término", evidenciaTexto: "Oferta e data final conferidas pela gestão" })).toMatchObject({ ok: true });
  comoSecretaria();
  expect(await proporCorrecaoRelatoIndisponibilidadeOferta({ registroId: aberto, inicio: "2026-10-11", fim: null, ...textos, chaveIdempotencia: "correcao-apos-termino" })).toMatchObject({ ok: false });
  const p = await proporCorrecaoRelatoIndisponibilidadeOferta({ registroId: aberto, inicio: "2026-10-04", fim: null, ...textos, chaveIdempotencia: "correcao-inicio-aberto" });
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  comoGestor();
  expect(await decidir(p.dado.id)).toMatchObject({ ok: true });
  expect(await estado("2026-10-03")).toMatchObject({ estado: "SEM_RELATO" });
  expect(await estado("2026-10-10")).toMatchObject({ estado: "INDISPONIVEL", registros: [{ inicio: "2026-10-04", fim: "2026-10-10" }] });

  const pendente = await relatoConfirmado("2026-11-01", "2026-11-05", "relato-correcao-pendente", false);
  expect(await proporCorrecaoRelatoIndisponibilidadeOferta({ registroId: pendente, inicio: "2026-11-02", fim: "2026-11-05", ...textos, chaveIdempotencia: "correcao-nao-confirmado" })).toMatchObject({ ok: false });
});

it("recusa retirar dias que já sustentam compensação aprovada, na ação e no banco; ampliar o período continua permitido", async () => {
  await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "ATIVA" } });
  const registroId = await relatoConfirmado("2026-10-01", "2026-10-10", "relato-correcao-compensado");
  const preparador = await criarUsuario(["FINANCEIRO"]);
  const cobranca = await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", moeda: "CRC", valorOriginal: 300, valorNegociado: 300, vencimento: new Date("2026-10-05"), coberturaInicio: new Date("2026-10-01"), coberturaFim: new Date("2026-10-31") } });
  const compensacao = await prisma.compensacaoCoberturaMatricula.create({ data: {
    matriculaId, cobrancaOrigemId: cobranca.id, preparadorId: preparador.id, motivo: "Indisponibilidade documentada", evidenciaCondicoes: "Condições do contrato conferidas",
    diasPropostos: ["2026-10-01"], coberturaOriginalInicio: new Date("2026-10-01"), coberturaOriginalFim: new Date("2026-10-31"), valorCoberturaOriginal: 300, moeda: "CRC", cobrancaVersao: cobranca.versao,
    status: "APROVADA", decisorId: gestorId, decididaEm: new Date(), motivoDecisao: "Conferência independente",
  } });
  await prisma.diaCompensacaoCobertura.create({ data: { compensacaoId: compensacao.id, matriculaId, diaOrigem: new Date("2026-10-01") } });

  expect(await proporCorrecaoRelatoIndisponibilidadeOferta({ registroId, inicio: "2026-10-03", fim: "2026-10-10", ...textos, chaveIdempotencia: "correcao-retira-compensado" }))
    .toMatchObject({ ok: false, erro: expect.stringContaining("compensação aprovada") });
  // C3 da #265: a recusa nomeia o dia e aponta o caminho.
  expect(await proporCorrecaoRelatoIndisponibilidadeOferta({ registroId, inicio: "2026-10-03", fim: "2026-10-10", ...textos, chaveIdempotencia: "correcao-retira-compensado-2" }))
    .toMatchObject({ ok: false, erro: expect.stringMatching(/01\/10\/2026.*mantenha esse dia.*Compensações da cobrança/) });
  // Escrita direta da proposta não contorna: a decisão aprovada é recusada pelo banco.
  const direta = await prisma.propostaCorrecaoRelatoIndisponibilidadeOferta.create({ data: {
    registroId, versao: 1, inicioAnterior: new Date("2026-10-01"), fimAnterior: new Date("2026-10-10"), inicioNovo: new Date("2026-10-03"), fimNovo: new Date("2026-10-10"),
    ...textos, autorId: secretariaId, chaveIdempotencia: "correcao-sql-direta", entradaHash: "b".repeat(64),
  } });
  await expect(prisma.decisaoCorrecaoRelatoIndisponibilidadeOferta.create({ data: { propostaId: direta.id, decisorId: gestorId, aprovada: true, motivo: "Aprovação por escrita direta", evidenciaTexto: "Evidência da escrita direta", entradaHash: "c".repeat(64) } }))
    .rejects.toThrow("compensação aprovada");
  comoGestor();
  expect(await decidir(direta.id, false)).toMatchObject({ ok: true, dado: { decisao: { aprovada: false } } });

  comoSecretaria();
  const amplia = await proporCorrecaoRelatoIndisponibilidadeOferta({ registroId, inicio: "2026-09-28", fim: "2026-10-12", ...textos, chaveIdempotencia: "correcao-amplia-periodo" });
  if (!amplia.ok || !amplia.dado) throw new Error(JSON.stringify(amplia));
  comoGestor();
  expect(await decidir(amplia.dado.id)).toMatchObject({ ok: true, dado: { decisao: { aprovada: true } } });
  expect(await prisma.registroIndisponibilidadeOfertaMatricula.findUniqueOrThrow({ where: { id: registroId } })).toMatchObject({ inicio: new Date("2026-09-28"), fim: new Date("2026-10-12") });
});

it("C3: quando outro relato confirmado também cobre o dia compensado, a recusa diz isso e continua conservadora", async () => {
  await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "ATIVA" } });
  const registroId = await relatoConfirmado("2026-10-01", "2026-10-10", "relato-c3-corrigido");
  await relatoConfirmado("2026-09-28", "2026-10-05", "relato-c3-outro");
  await relatoConfirmado("2026-09-20", "2026-10-02", "relato-c3-nao-confirmado", false);
  const preparador = await criarUsuario(["FINANCEIRO"]);
  const cobranca = await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", moeda: "CRC", valorOriginal: 300, valorNegociado: 300, vencimento: new Date("2026-10-05"), coberturaInicio: new Date("2026-10-01"), coberturaFim: new Date("2026-10-31") } });
  const compensacao = await prisma.compensacaoCoberturaMatricula.create({ data: {
    matriculaId, cobrancaOrigemId: cobranca.id, preparadorId: preparador.id, motivo: "Indisponibilidade documentada", evidenciaCondicoes: "Condições do contrato conferidas",
    diasPropostos: ["2026-10-01"], coberturaOriginalInicio: new Date("2026-10-01"), coberturaOriginalFim: new Date("2026-10-31"), valorCoberturaOriginal: 300, moeda: "CRC", cobrancaVersao: cobranca.versao,
    status: "APROVADA", decisorId: gestorId, decididaEm: new Date(), motivoDecisao: "Conferência independente",
  } });
  await prisma.diaCompensacaoCobertura.create({ data: { compensacaoId: compensacao.id, matriculaId, diaOrigem: new Date("2026-10-01") } });
  const r = await proporCorrecaoRelatoIndisponibilidadeOferta({ registroId, inicio: "2026-10-03", fim: "2026-10-10", ...textos, chaveIdempotencia: "correcao-c3-sobreposto" });
  expect(r).toMatchObject({ ok: false, erro: expect.stringContaining("também está coberto pelo relato confirmado de 28/09/2026 a 05/10/2026") });
  expect(r).toMatchObject({ ok: false, erro: expect.stringContaining("Compensações da cobrança") });
  expect(r).not.toMatchObject({ erro: expect.stringContaining("20/09/2026") });
  expect(await prisma.propostaCorrecaoRelatoIndisponibilidadeOferta.count()).toBe(0);
});
