import { beforeEach, expect, it, vi } from "vitest";
import { Papel, TipoCobranca } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async original => {
  const base = await original<typeof import("@/server/_shared/sessao")>(); const { prisma } = await import("@/lib/prisma");
  const sessao = async () => { const id = (await authMock())?.user?.id; const u = id && await prisma.usuario.findUnique({ where: { id } }); if (!u?.ativo) throw new base.ErroAutenticacao(); return u; };
  return { ...base, exigirSessao: sessao, exigirSessaoComPapel: async (...p: Papel[]) => { const u = await sessao(); base.exigirPapel(u, ...p); return u; } };
});

import { prisma } from "@/lib/prisma";
import { receberTx } from "@/server/financeiro/recebimentos";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararLoteMigracao } from "./acoes";
import { aplicarVinculoMigracao } from "./aplicar-vinculo";
import { proporConciliacaoFinanceiraMigracao } from "./conciliacao-financeira";
import { consultarConciliacaoFinanceiraMigracao, listarLinhasConciliacaoFinanceira } from "./consultas-financeiras";
import { ensaiarVinculoMigracao, revisarCorrespondenciaProdutoMigracao, revisarCorrespondenciaStatusMatriculaMigracao, revisarCorrespondenciaTurmaMigracao } from "./ensaio-vinculo";

let admin = "", financeiroA = "", financeiroB = "", professor = "";
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

async function base() {
  const c = await seedCatalogoMinimo(); const nivel = await prisma.nivel.create({ data: { idiomaId: c.idioma.id, codigo: "Q1", ordem: 1 } }); const turma = await prisma.turma.create({ data: { modalidadeId: c.modalidade.id, nivelId: nivel.id, codigo: "Q-FIN" } });
  entrar(admin);
  const lote = await prepararLoteMigracao({ origem: "PLANILHA", chaveLote: `q-v-${Date.now()}`, linhas: [{ linhaOrigem: "v!2", tipoEntrada: "VINCULO_MATRICULA", aluno: { id: "a-q", nome: "Ana Q", email: "a-q@example.test", documento: "DQ", pais: "CR", fuso: "America/Costa_Rica" }, turma: { id: "t-q", codigo: "Q-FIN" }, matricula: { id: "m-q", produtoOrigem: "p-q", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" }, alocacao: { inicio: "2025-01-01" }, consentimentoOrigem: "fonte" }] });
  if (!lote.ok || !lote.dado) throw new Error("lote"); const lv = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { loteId: lote.dado.loteId } }); const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", paisId: c.pais.id } });
  await prisma.mapaOrigemAlunoMigracao.create({ data: { id: "map-q", origem: "PLANILHA", alunoOrigemId: "a-q", alunoId: aluno.id } }); await revisarCorrespondenciaProdutoMigracao({ origem: "PLANILHA", produtoOrigemId: "p-q", produtoId: c.produto.id, paisId: c.pais.id, moeda: "CRC", ativa: true }); await revisarCorrespondenciaTurmaMigracao({ origem: "PLANILHA", turmaOrigemId: "t-q", turmaId: turma.id, ativa: true }); await revisarCorrespondenciaStatusMatriculaMigracao({ origem: "PLANILHA", statusOrigem: "ATIVA", statusDestino: "ATIVA", ativa: true });
  await ensaiarVinculoMigracao({ linhaId: lv.id }); const e = await prisma.ensaioVinculoMigracao.findFirstOrThrow({ where: { linhaId: lv.id } }); const aplicado = await aplicarVinculoMigracao({ linhaId: lv.id, ensaioId: e.id, entradaHash: lv.entradaHash, contextoHash: e.contextoHash, fusoReferencia: "America/Costa_Rica", semanticaFim: "LIMITE_EXCLUSIVO", inicioAlocacao: "2025-01-01", fimAlocacao: null, diaVencimento: 10, mesesPlano: 9, evidenciaContrato: { r: "contrato" }, evidenciaPagamento: { r: "pagamento" }, fatos: [{ tipo: "ATIVACAO", data: "2025-01-01", evidencia: { r: "ativo" } }] });
  if (!aplicado.ok || !aplicado.dado) throw new Error("aplicação"); const m = await prisma.matricula.findUniqueOrThrow({ where: { id: aplicado.dado.matriculaId } }); const cobranca = await prisma.cobranca.create({ data: { matriculaId: m.id, tipo: TipoCobranca.MENSALIDADE, valorOriginal: 10, valorNegociado: 10, moeda: "CRC", vencimento: new Date("2025-02-10Z") } });
  const fin = await prepararLoteMigracao({ origem: "PLANILHA", chaveLote: `q-f-${Date.now()}`, linhas: [{ linhaOrigem: "f!2", tipoEntrada: "FINANCEIRO_HISTORICO", aluno: { id: "a-q", nome: "Ana Q", email: "a-q@example.test", documento: "DQ", pais: "CR", fuso: "America/Costa_Rica" }, matricula: { id: "m-q", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" }, financeiro: { id: "f-q", tipo: "MENSALIDADE", valor: "10.00", moeda: "CRC", situacao: "PENDENTE" }, consentimentoOrigem: "fonte" }] });
  if (!fin.ok || !fin.dado) throw new Error("financeiro"); const linha = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { loteId: fin.dado.loteId } }); const pagador = await prisma.pagadorPreparacaoMatricula.create({ data: { matriculaId: m.id, preparadorId: financeiroA, versao: 1, tipo: "ALUNO", dados: { alunoId: aluno.id, nome: "Ana", paisId: c.pais.id }, motivo: "Pagador completo para a consulta financeira", chaveIdempotencia: "p-q-1", entradaHash: "p-q-1" } });
  return { c, aluno, m, cobranca, linha, pagador };
}

beforeEach(async () => { await truncarBanco(); admin = (await criarUsuario([Papel.ADMINISTRADOR])).id; financeiroA = (await criarUsuario([Papel.FINANCEIRO])).id; financeiroB = (await criarUsuario([Papel.FINANCEIRO])).id; professor = (await criarUsuario([Papel.PROFESSOR])).id; });

it("pagina coleções independentemente, valida cursores e calcula decisão por proposta", async () => {
  const f = await base();
  for (let i = 0; i < 20; i++) await prisma.cobranca.create({ data: { matriculaId: f.m.id, tipo: TipoCobranca.MENSALIDADE, valorOriginal: i + 1, valorNegociado: i + 1, moeda: "CRC", vencimento: new Date("2025-02-10Z") } });
  const cobrancas = await prisma.cobranca.findMany({ where: { matriculaId: f.m.id }, orderBy: { id: "asc" } });
  for (let i = 0; i < 21; i++) await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobrancas[i]!.id, autorId: financeiroB, chaveIdempotencia: `q-r-${i}`, valorRecebido: 1, forma: "DINHEIRO", dataPagamento: new Date("2025-02-03T00:00:00Z"), evidencia: "Recebimento histórico para paginação financeira." }));
  for (let i = 2; i <= 21; i++) await prisma.pagadorPreparacaoMatricula.create({ data: { matriculaId: f.m.id, preparadorId: financeiroA, versao: i, tipo: "ALUNO", dados: { alunoId: f.aluno.id, nome: "Ana", paisId: f.c.pais.id }, motivo: `Pagador histórico conferido na versão ${i}`, chaveIdempotencia: `p-q-${i}`, entradaHash: `p-q-${i}` } });
  entrar(financeiroA); let proposta = await proporConciliacaoFinanceiraMigracao({ linhaId: f.linha.id, matriculaId: f.m.id, cobrancaId: f.cobranca.id, pagadorId: f.pagador.id, modalidade: "PENDENCIA", evidencia: { r: "fonte" }, chaveIdempotencia: uuid(1) }); if (!proposta.ok || !proposta.dado) throw new Error("proposta");
  for (let i = 2; i <= 21; i++) { proposta = await proporConciliacaoFinanceiraMigracao({ linhaId: f.linha.id, matriculaId: f.m.id, cobrancaId: f.cobranca.id, pagadorId: f.pagador.id, modalidade: "PENDENCIA", evidencia: { r: "fonte" }, chaveIdempotencia: uuid(i) }); if (!proposta.ok || !proposta.dado) throw new Error("proposta paginada"); }
  const propostaFinal = proposta.dado.id;
  const primeira = await consultarConciliacaoFinanceiraMigracao({ linhaId: f.linha.id }); if (!primeira.ok || !primeira.dado) throw new Error("consulta"); expect(primeira.dado.propostas.some(p => p.id === propostaFinal && !p.podeDecidir)).toBe(true); expect(primeira.dado.cobrancas).toHaveLength(20); expect(primeira.dado.recebimentos).toHaveLength(20); expect(primeira.dado.pagadores).toHaveLength(20); expect(primeira.dado.propostas).toHaveLength(20); expect(primeira.dado.proximoCursor).toBeTruthy(); expect(primeira.dado.proximoCursorRecebimentos).toBeTruthy(); expect(primeira.dado.proximoCursorPagadores).toBeTruthy(); expect(primeira.dado.proximoCursorPropostas).toBeTruthy();
  const segunda = await consultarConciliacaoFinanceiraMigracao({ linhaId: f.linha.id, cursor: primeira.dado.proximoCursor!, cursorRecebimentos: primeira.dado.proximoCursorRecebimentos!, cursorPagadores: primeira.dado.proximoCursorPagadores!, cursorPropostas: primeira.dado.proximoCursorPropostas! }); expect(segunda).toMatchObject({ ok: true, dado: { cobrancas: [expect.any(Object)], recebimentos: [expect.any(Object)], pagadores: [expect.any(Object)], propostas: [expect.any(Object)] } });
  entrar(financeiroB); const outro = await consultarConciliacaoFinanceiraMigracao({ linhaId: f.linha.id }); if (!outro.ok || !outro.dado) throw new Error("consulta por outro financeiro"); expect(outro.dado.propostas.some(p => p.id === propostaFinal && p.podeDecidir)).toBe(true);
  const estrangeira = await prisma.matricula.create({ data: { alunoId: f.aluno.id, produtoId: f.c.produto.id, paisId: f.c.pais.id, moeda: "CRC" } }); const cursorEstrangeiro = (await prisma.cobranca.create({ data: { matriculaId: estrangeira.id, tipo: TipoCobranca.MENSALIDADE, valorOriginal: 1, valorNegociado: 1, moeda: "CRC", vencimento: new Date("2025-02-10Z") } })).id;
  expect(await consultarConciliacaoFinanceiraMigracao({ linhaId: f.linha.id, cursor: cursorEstrangeiro })).toMatchObject({ ok: false, erro: expect.stringContaining("Página inválida") }); entrar(professor); expect(await consultarConciliacaoFinanceiraMigracao({ linhaId: f.linha.id })).toMatchObject({ ok: false });
});

it("pagina a fila financeira e não a expõe a professores", async () => {
  const f = await base(); const dadosOrigem = f.linha.dadosOrigem; if (dadosOrigem === null) throw new Error("fixture financeira sem origem");
  await Promise.all(Array.from({ length: 20 }, (_, i) => prisma.linhaPreparacaoMigracao.create({ data: { loteId: f.linha.loteId, linhaOrigem: `f!${i + 3}`, alunoOrigemId: "a-q", matriculaOrigemId: `m-fila-${i}`, financeiroOrigemId: `f-fila-${i}`, dadosOrigem, entradaHash: `fila-${i}`, estado: "PRONTA_PARA_REVISAO", tipoEntrada: "FINANCEIRO_HISTORICO" } })));
  entrar(financeiroA); const primeira = await listarLinhasConciliacaoFinanceira(); expect(primeira.ok).toBe(true); if (!primeira.ok || !primeira.dado) throw new Error("fila"); expect(primeira.dado.itens).toHaveLength(20); expect(primeira.dado.proximoCursor).toBeTruthy(); const segunda = await listarLinhasConciliacaoFinanceira({ cursor: primeira.dado.proximoCursor! }); expect(segunda).toMatchObject({ ok: true, dado: { itens: [expect.any(Object)] } });
  const vinculo = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { tipoEntrada: "VINCULO_MATRICULA" } }); expect(await listarLinhasConciliacaoFinanceira({ cursor: vinculo.id })).toMatchObject({ ok: false, erro: expect.stringContaining("Página de conciliação inválida") }); entrar(professor); expect(await listarLinhasConciliacaoFinanceira()).toMatchObject({ ok: false });
});

it("reconhece replay de pendência quando campos opcionais chegam como undefined", async () => {
  const f = await base(); entrar(financeiroA); const comum = { linhaId: f.linha.id, matriculaId: f.m.id, cobrancaId: f.cobranca.id, pagadorId: f.pagador.id, modalidade: "PENDENCIA" as const, evidencia: { r: "fonte" }, chaveIdempotencia: uuid(99) };
  const primeiro = await proporConciliacaoFinanceiraMigracao({ ...comum, valor: undefined, moeda: undefined, forma: undefined, recebimentoExistenteId: undefined, complemento: undefined }); if (!primeiro.ok || !primeiro.dado) throw new Error("proposta inicial"); const replay = await proporConciliacaoFinanceiraMigracao(comum); expect(replay).toMatchObject({ ok: true, dado: { id: primeiro.dado.id } });
});
