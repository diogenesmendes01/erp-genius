import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormaPagamento, Papel, TipoCobranca } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async importOriginal => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const { prisma } = await import("@/lib/prisma");
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararLoteMigracao } from "./acoes";
import { aplicarVinculoMigracao } from "./aplicar-vinculo";
import { decidirConciliacaoFinanceiraMigracao, proporConciliacaoFinanceiraMigracao } from "./conciliacao-financeira";
import { consultarConciliacaoFinanceiraMigracao } from "./consultas-financeiras";
import { ensaiarVinculoMigracao, revisarCorrespondenciaProdutoMigracao, revisarCorrespondenciaStatusMatriculaMigracao, revisarCorrespondenciaTurmaMigracao } from "./ensaio-vinculo";

const dataHistorica = "2025-02-03T14:15:16.000Z";
const chave = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

let preparadorId = "";
let decisorId = "";
let administradorId = "";
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

async function fixture() {
  const catalogo = await seedCatalogoMinimo();
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, codigo: "MIG-FIN" } });
  entrar(administradorId);
  const vinculo = await prepararLoteMigracao({ origem: "PLANILHA", chaveLote: `vinculo-financeiro-${Date.now()}-${Math.random()}`, linhas: [{
    linhaOrigem: "vinculos!2", tipoEntrada: "VINCULO_MATRICULA",
    aluno: { id: "aluno-legado-42", nome: "Ana Migração", email: "ana.migracao@example.test", documento: "DOC-42", pais: "CR", fuso: "America/Costa_Rica" },
    turma: { id: "turma-legada-42", codigo: "MIG-FIN" },
    matricula: { id: "matricula-legada-42", produtoOrigem: "produto-legado-42", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" },
    alocacao: { inicio: "2025-01-01" }, consentimentoOrigem: "fonte histórica",
  }] });
  if (!vinculo.ok || !vinculo.dado) throw new Error("Vínculo histórico não preparado.");
  const linhaVinculo = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { loteId: vinculo.dado.loteId } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", sobrenome: "Migração", paisId: catalogo.pais.id } });
  await prisma.mapaOrigemAlunoMigracao.create({ data: { id: "mapa-aluno-42", origem: "PLANILHA", alunoOrigemId: "aluno-legado-42", alunoId: aluno.id } });
  await revisarCorrespondenciaProdutoMigracao({ origem: "PLANILHA", produtoOrigemId: "produto-legado-42", produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", ativa: true });
  await revisarCorrespondenciaTurmaMigracao({ origem: "PLANILHA", turmaOrigemId: "turma-legada-42", turmaId: turma.id, ativa: true });
  await revisarCorrespondenciaStatusMatriculaMigracao({ origem: "PLANILHA", statusOrigem: "ATIVA", statusDestino: "ATIVA", ativa: true });
  const ensaio = await ensaiarVinculoMigracao({ linhaId: linhaVinculo.id });
  if (!ensaio.ok || ensaio.dado?.resultado !== "PRONTO_PARA_REVISAO") throw new Error("Ensaio de vínculo indisponível.");
  const ensaioSalvo = await prisma.ensaioVinculoMigracao.findFirstOrThrow({ where: { linhaId: linhaVinculo.id }, orderBy: { criadoEm: "desc" } });
  const aplicado = await aplicarVinculoMigracao({
    linhaId: linhaVinculo.id, ensaioId: ensaioSalvo.id, entradaHash: linhaVinculo.entradaHash, contextoHash: ensaioSalvo.contextoHash,
    fusoReferencia: "America/Costa_Rica", semanticaFim: "LIMITE_EXCLUSIVO", inicioAlocacao: "2025-01-01", fimAlocacao: null,
    diaVencimento: 10, mesesPlano: 9, evidenciaContrato: { referencia: "contrato legado 42" }, evidenciaPagamento: { referencia: "pagamento legado 42" },
    fatos: [{ tipo: "ATIVACAO", data: "2025-01-01", evidencia: { referencia: "situação ativa na fonte" } }],
  });
  if (!aplicado.ok || !aplicado.dado) throw new Error("Vínculo histórico não aplicado.");
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: aplicado.dado.matriculaId } });
  const cobranca = await prisma.cobranca.create({ data: {
    matriculaId: matricula.id, tipo: TipoCobranca.MENSALIDADE, valorOriginal: 85000, valorNegociado: 85000,
    moeda: "CRC", vencimento: new Date("2025-02-10T00:00:00.000Z"), comprovanteUrl: "/fontes/recibo-42.pdf",
    comprovanteNome: "recibo-42.pdf", comentario: "Fonte histórica conferida",
  } });
  const financeiro = await prepararLoteMigracao({ origem: "PLANILHA", chaveLote: `financeiro-${Date.now()}-${Math.random()}`, linhas: [{
    linhaOrigem: "financeiro!2", tipoEntrada: "FINANCEIRO_HISTORICO",
    aluno: { id: "aluno-legado-42", nome: "Ana Migração", email: "ana.migracao@example.test", documento: "DOC-42", pais: "CR", fuso: "America/Costa_Rica" },
    matricula: { id: "matricula-legada-42", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" },
    financeiro: { id: "financeiro-legado-42", tipo: "MENSALIDADE", valor: "85000.00", moeda: "CRC", situacao: "PAGO" }, consentimentoOrigem: "fonte histórica",
  }] });
  if (!financeiro.ok || !financeiro.dado) throw new Error("Linha financeira não preparada.");
  const linha = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { loteId: financeiro.dado.loteId } });
  const pagador = await prisma.pagadorPreparacaoMatricula.create({ data: {
    matriculaId: matricula.id, preparadorId, versao: 1, tipo: "ALUNO", dados: { alunoId: aluno.id, nome: "Ana Migração", paisId: catalogo.pais.id, documento: "DOC-42", email: "ana.migracao@example.test", telefoneE164: null, endereco: null },
    motivo: "Pagador explícito conferido na fonte histórica", chaveIdempotencia: `pagador-${matricula.id}`, entradaHash: `pagador-${matricula.id}`,
  } });
  return { aluno, matricula, cobranca, linha, pagador, catalogo };
}

function entrada(f: Awaited<ReturnType<typeof fixture>>, modalidade: "PENDENCIA" | "BAIXAR" | "VINCULAR_RECEBIMENTO", numero: number, recebimentoExistenteId?: string) {
  const complemento = modalidade === "PENDENCIA" ? {} : { complemento: { itens: [
    { campo: "situacao", valorProposto: "PAGAMENTO_COMPROVADO", motivo: "Recibo comprova a situação histórica do pagamento.", evidencia: { recibo: "42" } },
    { campo: "dataPagamento", valorProposto: dataHistorica, motivo: "Recibo conserva a data histórica de pagamento.", evidencia: { recibo: "42" } },
    { campo: "forma", valorProposto: FormaPagamento.TRANSFERENCIA, motivo: "Recibo identifica a forma de pagamento utilizada.", evidencia: { recibo: "42" } },
    { campo: "pagadorId", valorProposto: f.pagador.id, motivo: "Pagador foi conferido no contrato migrado correspondente.", evidencia: { contrato: "42" } },
  ] } };
  return {
    linhaId: f.linha.id, matriculaId: f.matricula.id, cobrancaId: f.cobranca.id, pagadorId: f.pagador.id, modalidade,
    ...(modalidade === "PENDENCIA" ? {} : { valor: "85000.00", moeda: "CRC", dataPagamento: dataHistorica, forma: FormaPagamento.TRANSFERENCIA }),
    ...complemento, ...(recebimentoExistenteId ? { recebimentoExistenteId } : {}), evidencia: { recibo: "42", planilha: "financeiro!2" }, chaveIdempotencia: chave(numero),
  };
}

async function propor(f: Awaited<ReturnType<typeof fixture>>, modalidade: "PENDENCIA" | "BAIXAR" | "VINCULAR_RECEBIMENTO", numero: number, recebimentoExistenteId?: string) {
  entrar(preparadorId);
  const r = await proporConciliacaoFinanceiraMigracao(entrada(f, modalidade, numero, recebimentoExistenteId));
  expect(r.ok, r.ok ? undefined : r.erro).toBe(true);
  if (!r.ok || !r.dado) throw new Error("Proposta não criada.");
  return r.dado.id;
}

async function decidir(propostaId: string, aprovada: boolean, numero: number, id = decisorId) {
  entrar(id);
  return decidirConciliacaoFinanceiraMigracao({ propostaId, aprovada, motivo: "Conferência financeira independente e documentada.", chaveIdempotencia: chave(numero) });
}

beforeEach(async () => {
  await truncarBanco();
  administradorId = (await criarUsuario([Papel.ADMINISTRADOR], "Administrador migração")).id;
  preparadorId = (await criarUsuario([Papel.FINANCEIRO], "Preparador financeiro")).id;
  decisorId = (await criarUsuario([Papel.FINANCEIRO], "Decisor financeiro")).id;
  entrar(preparadorId);
});

describe("M01 conciliação financeira de migração", () => {
  it("separa proposta de decisão: o preparador não pode decidir a própria proposta", async () => {
    const f = await fixture();
    const propostaId = await propor(f, "PENDENCIA", 1);
    expect(await decidir(propostaId, true, 2, preparadorId)).toMatchObject({ ok: false, erro: expect.stringContaining("outro usuário") });
    expect(await decidir(propostaId, true, 3)).toMatchObject({ ok: true, dado: { id: propostaId, recebimentoId: null } });
    expect(await prisma.propostaConciliacaoFinanceiraMigracao.findUniqueOrThrow({ where: { id: propostaId } })).toMatchObject({ status: "APLICADA", decisorId });
  });

  it("baixa com a data, o valor e o autor da decisão, sem herdar os dados do preparador", async () => {
    const f = await fixture();
    const propostaId = await propor(f, "BAIXAR", 10);
    const aplicada = await decidir(propostaId, true, 11);
    expect(aplicada.ok, aplicada.ok ? undefined : aplicada.erro).toBe(true);
    if (!aplicada.ok || !aplicada.dado?.recebimentoId) throw new Error("Baixa ausente.");
    const recebimento = await prisma.recebimento.findUniqueOrThrow({ where: { id: aplicada.dado.recebimentoId } });
    expect(recebimento).toMatchObject({
      cobrancaId: f.cobranca.id, autorId: decisorId, moeda: "CRC", forma: FormaPagamento.TRANSFERENCIA,
      dataPagamento: new Date(dataHistorica),
    });
    expect(recebimento.valor.toFixed(2)).toBe("85000.00");
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: f.cobranca.id } })).comprovanteUrl).toBe("/fontes/recibo-42.pdf");
  });

  it("vincula um recebimento ERP já existente sem criar outro", async () => {
    const f = await fixture();
    const existente = await prisma.recebimento.create({ data: {
      cobrancaId: f.cobranca.id, autorId: decisorId, chaveIdempotencia: "recebimento-erp-existente", valor: 85000,
      moeda: "CRC", forma: FormaPagamento.TRANSFERENCIA, dataPagamento: new Date(dataHistorica), hashDados: "fonte-erp-42",
    } });
    const propostaId = await propor(f, "VINCULAR_RECEBIMENTO", 20, existente.id);
    expect(await decidir(propostaId, true, 21)).toMatchObject({ ok: true, dado: { recebimentoId: existente.id } });
    expect(await prisma.recebimento.count({ where: { cobrancaId: f.cobranca.id } })).toBe(1);
    expect(await prisma.conciliacaoFinanceiraMigracao.findFirstOrThrow({ where: { propostaId } })).toMatchObject({ recebimentoId: existente.id, aplicadaPorId: decisorId });
  });

  it("registra pendência sem fabricar recebimento", async () => {
    const f = await fixture();
    const propostaId = await propor(f, "PENDENCIA", 30);
    expect(await decidir(propostaId, true, 31)).toMatchObject({ ok: true, dado: { recebimentoId: null } });
    expect(await prisma.recebimento.count({ where: { cobrancaId: f.cobranca.id } })).toBe(0);
    expect(await prisma.conciliacaoFinanceiraMigracao.findFirstOrThrow({ where: { propostaId } })).toMatchObject({ recebimentoId: null });
  });

  it("permite resolver uma pendência por baixa única e bloqueia novas aplicações para a mesma origem", async () => {
    const f = await fixture();
    const pendenciaId = await propor(f, "PENDENCIA", 32);
    expect(await decidir(pendenciaId, true, 33)).toMatchObject({ ok: true, dado: { recebimentoId: null } });
    entrar(preparadorId);
    expect(await proporConciliacaoFinanceiraMigracao(entrada(f, "PENDENCIA", 34))).toMatchObject({ ok: false });

    const baixaId = await propor(f, "BAIXAR", 35);
    const aplicada = await decidir(baixaId, true, 36);
    expect(aplicada.ok, aplicada.ok ? undefined : aplicada.erro).toBe(true);
    if (!aplicada.ok || !aplicada.dado?.recebimentoId) throw new Error("Resolução monetária ausente.");
    expect(await decidir(baixaId, true, 36)).toMatchObject({ ok: true, dado: { id: baixaId, repetida: true } });
    expect(await prisma.recebimento.count({ where: { cobrancaId: f.cobranca.id } })).toBe(1);
    expect(await prisma.conciliacaoFinanceiraMigracao.findMany({ where: { origem: "PLANILHA", financeiroOrigemId: "financeiro-legado-42" }, orderBy: { aplicadaEm: "asc" } })).toMatchObject([
      { propostaId: pendenciaId, recebimentoId: null }, { propostaId: baixaId, recebimentoId: aplicada.dado.recebimentoId },
    ]);
    const consulta = await consultarConciliacaoFinanceiraMigracao({ linhaId: f.linha.id });
    expect(consulta).toMatchObject({ ok: true, dado: { pendenciaRegistrada: true, resolucao: { recebimentoId: aplicada.dado.recebimentoId } } });

    entrar(preparadorId);
    expect(await proporConciliacaoFinanceiraMigracao(entrada(f, "BAIXAR", 37))).toMatchObject({ ok: false });
    expect(await proporConciliacaoFinanceiraMigracao(entrada(f, "PENDENCIA", 38))).toMatchObject({ ok: false });
    expect(await prisma.recebimento.count({ where: { cobrancaId: f.cobranca.id } })).toBe(1);
    expect(await prisma.conciliacaoFinanceiraMigracao.count({ where: { origem: "PLANILHA", financeiroOrigemId: "financeiro-legado-42", recebimentoId: { not: null } } })).toBe(1);
  });

  it("recusa replay divergente da mesma chave de proposta", async () => {
    const f = await fixture();
    await propor(f, "BAIXAR", 40);
    entrar(preparadorId);
    expect(await proporConciliacaoFinanceiraMigracao({ ...entrada(f, "BAIXAR", 40), valor: "84000.00" })).toMatchObject({ ok: false, erro: expect.stringContaining("chave idempotente") });
    expect(await prisma.propostaConciliacaoFinanceiraMigracao.count()).toBe(1);
  });

  it("recusa pagamento sem complemento evidenciado para a situação", async () => {
    const f = await fixture();
    entrar(preparadorId);
    const original = entrada(f, "BAIXAR", 45);
    const itens = original.complemento!.itens.filter(item => item.campo !== "situacao");
    expect(await proporConciliacaoFinanceiraMigracao({ ...original, complemento: { itens } })).toMatchObject({ ok: false, erro: expect.stringContaining("situacao") });
    expect(await prisma.propostaConciliacaoFinanceiraMigracao.count()).toBe(0);
    expect(await prisma.recebimento.count()).toBe(0);
  });

  it("exige complemento explícito quando o valor proposto diverge da fonte", async () => {
    const f = await fixture();
    entrar(preparadorId);
    const original = entrada(f, "BAIXAR", 46);
    expect(await proporConciliacaoFinanceiraMigracao({ ...original, valor: "84000.00" })).toMatchObject({ ok: false, erro: expect.stringContaining("valor") });
    expect(await prisma.propostaConciliacaoFinanceiraMigracao.count()).toBe(0);
    expect(await prisma.recebimento.count()).toBe(0);
  });

  it("recusa aprovação quando a fotografia financeira ficou obsoleta", async () => {
    const f = await fixture();
    const propostaId = await propor(f, "PENDENCIA", 50);
    await prisma.cobranca.update({ where: { id: f.cobranca.id }, data: { comentario: "Cobrança alterada depois da proposta" } });
    expect(await decidir(propostaId, true, 51)).toMatchObject({ ok: false, erro: expect.stringContaining("fotografia") });
    expect(await prisma.conciliacaoFinanceiraMigracao.count()).toBe(0);
  });

  it("recusa seleção de outro contrato da mesma pessoa", async () => {
    const f = await fixture();
    const outraMatricula = await prisma.matricula.create({ data: { alunoId: f.aluno.id, produtoId: f.catalogo.produto.id, paisId: f.catalogo.pais.id, moeda: "CRC" } });
    const outraCobranca = await prisma.cobranca.create({ data: { matriculaId: outraMatricula.id, tipo: TipoCobranca.MENSALIDADE, valorOriginal: 85000, valorNegociado: 85000, moeda: "CRC", vencimento: f.cobranca.vencimento } });
    const outroPagador = await prisma.pagadorPreparacaoMatricula.create({ data: {
      matriculaId: outraMatricula.id, preparadorId, versao: 1, tipo: "ALUNO", dados: { alunoId: f.aluno.id, nome: "Ana Migração", paisId: f.catalogo.pais.id, documento: "DOC-42", email: "ana.migracao@example.test", telefoneE164: null, endereco: null }, motivo: "Pagador de outro contrato da mesma pessoa", chaveIdempotencia: `pagador-${outraMatricula.id}`, entradaHash: `pagador-${outraMatricula.id}`,
    } });
    entrar(preparadorId);
    expect(await proporConciliacaoFinanceiraMigracao({ ...entrada(f, "PENDENCIA", 60), matriculaId: outraMatricula.id, cobrancaId: outraCobranca.id, pagadorId: outroPagador.id })).toMatchObject({ ok: false, erro: expect.stringContaining("não corresponde ao vínculo M01") });
    expect(await prisma.propostaConciliacaoFinanceiraMigracao.count()).toBe(0);
    expect(await prisma.conciliacaoFinanceiraMigracao.count()).toBe(0);
    expect(await prisma.recebimento.count()).toBe(0);
  });

  it("permite nova revisão após rejeição usando o mesmo recibo ERP", async () => {
    const f = await fixture();
    const existente = await prisma.recebimento.create({ data: {
      cobrancaId: f.cobranca.id, autorId: decisorId, chaveIdempotencia: "recibo-revisavel", valor: 85000,
      moeda: "CRC", forma: FormaPagamento.TRANSFERENCIA, dataPagamento: new Date(dataHistorica), hashDados: "recibo-revisavel-hash",
    } });
    const rejeitadaId = await propor(f, "VINCULAR_RECEBIMENTO", 70, existente.id);
    expect(await decidir(rejeitadaId, false, 71)).toMatchObject({ ok: true, dado: { rejeitada: true } });
    const revisadaId = await propor(f, "VINCULAR_RECEBIMENTO", 72, existente.id);
    expect(revisadaId).not.toBe(rejeitadaId);
    expect(await decidir(revisadaId, true, 73)).toMatchObject({ ok: true, dado: { recebimentoId: existente.id } });
    expect(await prisma.propostaConciliacaoFinanceiraMigracao.findMany({ orderBy: { versao: "asc" } })).toMatchObject([
      { id: rejeitadaId, status: "REJEITADA", versao: 1 }, { id: revisadaId, status: "APLICADA", versao: 2 },
    ]);
    expect(await prisma.recebimento.count({ where: { id: existente.id } })).toBe(1);
  });

  it("rejeita no commit SQL a transição pendente para aprovada sem aplicação", async () => {
    const f = await fixture();
    const propostaId = await propor(f, "PENDENCIA", 80);
    await expect(prisma.$executeRaw`
      UPDATE "PropostaConciliacaoFinanceiraMigracao"
      SET status='APROVADA'::"StatusPropostaConciliacaoFinanceiraMigracao", "decisorId"=${decisorId},
        "motivoDecisao"='Tentativa adversarial sem aplicação correspondente.', "chaveDecisao"=${chave(81)}, "decididoEm"=CURRENT_TIMESTAMP
      WHERE id=${propostaId}
    `).rejects.toThrow(/mesmo commit/);
    expect(await prisma.propostaConciliacaoFinanceiraMigracao.findUniqueOrThrow({ where: { id: propostaId } })).toMatchObject({ status: "PENDENTE", decisorId: null });
    expect(await prisma.conciliacaoFinanceiraMigracao.count()).toBe(0);
  });

  it("rejeita INSERT SQL que tenta vincular recibo de outro contrato", async () => {
    const f = await fixture();
    const propostaId = await propor(f, "PENDENCIA", 90);
    const outraMatricula = await prisma.matricula.create({ data: { alunoId: f.aluno.id, produtoId: f.catalogo.produto.id, paisId: f.catalogo.pais.id, moeda: "CRC" } });
    const outraCobranca = await prisma.cobranca.create({ data: { matriculaId: outraMatricula.id, tipo: TipoCobranca.MENSALIDADE, valorOriginal: 85000, valorNegociado: 85000, moeda: "CRC", vencimento: f.cobranca.vencimento } });
    const reciboEstrangeiro = await prisma.recebimento.create({ data: { cobrancaId: outraCobranca.id, autorId: decisorId, chaveIdempotencia: "recibo-outro-contrato", valor: 85000, moeda: "CRC", forma: FormaPagamento.TRANSFERENCIA, dataPagamento: new Date(dataHistorica) } });
    const forjada = entrada(f, "VINCULAR_RECEBIMENTO", 91, reciboEstrangeiro.id);
    await expect(prisma.$executeRaw`
      INSERT INTO "PropostaConciliacaoFinanceiraMigracao" (
        id,origem,"financeiroOrigemId",versao,"linhaId","matriculaId","cobrancaId","pagadorId","preparadorId",
        modalidade,valor,moeda,"dataPagamento",forma,"recebimentoExistenteId",evidencia,complemento,entrada,snapshot,"entradaHash","estadoHash","chaveIdempotencia"
      ) SELECT ${"forjada-recibo-outro-contrato"},origem,"financeiroOrigemId",2,"linhaId","matriculaId","cobrancaId","pagadorId","preparadorId",
        'VINCULAR_RECEBIMENTO'::"ModalidadeConciliacaoFinanceiraMigracao",85000,'CRC',${new Date(dataHistorica)},'TRANSFERENCIA'::"FormaPagamento",${reciboEstrangeiro.id},evidencia,${JSON.stringify(forjada.complemento)}::jsonb,${JSON.stringify(forjada)}::jsonb,snapshot,"entradaHash","estadoHash",${chave(91)}
      FROM "PropostaConciliacaoFinanceiraMigracao" WHERE id=${propostaId}
    `).rejects.toThrow(/Recebimento existente não corresponde/);
    expect(await prisma.propostaConciliacaoFinanceiraMigracao.count()).toBe(1);
    expect(await prisma.conciliacaoFinanceiraMigracao.count()).toBe(0);
  });

  it("rejeita no SQL o instante divergente quando a sessão usa America/Sao_Paulo", async () => {
    const f = await fixture();
    const propostaId = await propor(f, "PENDENCIA", 100);
    const recibo = await prisma.recebimento.create({ data: { cobrancaId: f.cobranca.id, autorId: decisorId, chaveIdempotencia: "recibo-utc-sao-paulo", valor: 85000, moeda: "CRC", forma: FormaPagamento.TRANSFERENCIA, dataPagamento: new Date(dataHistorica) } });
    const forjada = entrada(f, "VINCULAR_RECEBIMENTO", 101, recibo.id);
    forjada.dataPagamento = "2025-02-03T14:15:16.000-03:00";
    forjada.complemento!.itens = forjada.complemento!.itens.map(item => item.campo === "dataPagamento" ? { ...item, valorProposto: forjada.dataPagamento! } : item);
    await expect(prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL TIME ZONE 'America/Sao_Paulo'`;
      await tx.$executeRaw`
        INSERT INTO "PropostaConciliacaoFinanceiraMigracao" (
          id,origem,"financeiroOrigemId",versao,"linhaId","matriculaId","cobrancaId","pagadorId","preparadorId",
          modalidade,valor,moeda,"dataPagamento",forma,"recebimentoExistenteId",evidencia,complemento,entrada,snapshot,"entradaHash","estadoHash","chaveIdempotencia"
        ) SELECT ${"forjada-fuso-sao-paulo"},origem,"financeiroOrigemId",2,"linhaId","matriculaId","cobrancaId","pagadorId","preparadorId",
          'VINCULAR_RECEBIMENTO'::"ModalidadeConciliacaoFinanceiraMigracao",85000,'CRC',${new Date("2025-02-03T14:15:16.000-03:00")},'TRANSFERENCIA'::"FormaPagamento",${recibo.id},evidencia,${JSON.stringify(forjada.complemento)}::jsonb,${JSON.stringify(forjada)}::jsonb,snapshot,"entradaHash","estadoHash",${chave(101)}
        FROM "PropostaConciliacaoFinanceiraMigracao" WHERE id=${propostaId}
      `;
    })).rejects.toThrow(/Recebimento existente não corresponde/);
    expect(await prisma.propostaConciliacaoFinanceiraMigracao.count()).toBe(1);
    expect(await prisma.conciliacaoFinanceiraMigracao.count()).toBe(0);
  });

  it("rejeita INSERT SQL cuja entrada auditada não reproduz a proposta", async () => {
    const f = await fixture();
    const propostaId = await propor(f, "PENDENCIA", 110);
    await expect(prisma.$executeRaw`
      INSERT INTO "PropostaConciliacaoFinanceiraMigracao" (
        id,origem,"financeiroOrigemId",versao,"linhaId","matriculaId","cobrancaId","pagadorId","preparadorId",
        modalidade,evidencia,entrada,snapshot,"entradaHash","estadoHash","chaveIdempotencia"
      ) SELECT ${"forjada-entrada-divergente"},origem,"financeiroOrigemId",2,"linhaId","matriculaId","cobrancaId","pagadorId","preparadorId",
        modalidade,evidencia,'{}'::jsonb,snapshot,"entradaHash","estadoHash",${chave(111)}
      FROM "PropostaConciliacaoFinanceiraMigracao" WHERE id=${propostaId}
    `).rejects.toThrow(/Entrada auditada diverge/);
    expect(await prisma.propostaConciliacaoFinanceiraMigracao.count()).toBe(1);
  });
});
