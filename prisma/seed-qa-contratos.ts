// Seed de QA: modelos contratuais por país, contratos (rascunho, enviado, assinado, cancelado/substituído) e
// aditivos para alunos reais já gravados pelo seed-qa-dados. Assinatura SEMPRE simulada (fornecedor SIMULADO,
// ambiente SANDBOX): nenhum envio externo, e-mail ou WhatsApp é disparado. Usa os serviços reais do ERP.
//
//   TSX_TSCONFIG_PATH=prisma/tsconfig.seed-qa.json QA_MODELOS_JSON=/caminho/qa-modelos-contratuais.json \
//     npx tsx prisma/seed-qa-contratos.ts
//
// Os textos dos modelos (dados da empresa) ficam fora do repositório, no JSON indicado por QA_MODELOS_JSON.
// Idempotente: cada contrato tem lead `qa_lead_contrato_<aluno>`; o marcador em Lead.objetivo/urgencia
// indica cadeia concluída e é pulado ao re-rodar. Remoção: prisma/cleanup-qa.ts.
import { referenciaSimulada } from "@/server/contratos/provedor-assinatura-simulado";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { qaId, PREFIXO_ID } from "./seed-qa-comum";
import { prepararContratacaoTx } from "@/server/matricula/preparacao-comercial-tx";
import { registrarPagadorPreparacao } from "@/server/secretaria/pagador-preparacao";
import { registrarCondicoesEntrada } from "@/server/secretaria/condicoes-entrada";
import { consultarRevisaoEmissao, conferirEEmitirEntrada } from "@/server/secretaria/conferencia-emissao";
import { prepararModeloContratual, decidirModeloContratual } from "@/server/contratos/modelos";
import { consultarPreenchimentoContratual, registrarPreviaContratual } from "@/server/contratos/previas";
import { conferirParticipantesContratuais } from "@/server/contratos/participantes";
import { preservarOriginalContratual } from "@/server/contratos/originais";
import { consultarConferenciaAssinatura, registrarConferenciaAssinatura } from "@/server/contratos/assinatura-conferencia";
import { prepararProcessoEnvioTx, iniciarTentativaAssinaturaTx, registrarResultadoEnvioTx } from "@/server/contratos/envio-tx";
import { preservarConclusaoAssinaturaTx } from "@/server/contratos/conclusao-assinatura-tx";
import { hashPrevia } from "@/server/contratos/previa-estado";
import { IdentidadeSignatarioSchema } from "@/server/contratos/participantes-schema";
import { prepararSubstituicaoContratualTx, decidirSubstituicaoContratualTx } from "@/server/contratos/substituicao-tx";
import { iniciarCancelamentoAssinaturaTx, registrarObservacaoCancelamentoTx } from "@/server/contratos/cancelamento-assinatura-tx";
import { aplicarSubstituicaoContratualTx } from "@/server/contratos/substituicao-aplicar-tx";
import { prepararAditivoContratualTx, decidirAditivoContratualTx } from "@/server/contratos/aditivo-tx";
import { decidirAlcadaAditivo } from "@/server/contratos/aditivo-alcadas";
import { conferirParticipantesAditivoTx } from "@/server/contratos/aditivo-participantes-tx";
import { preservarOriginalAditivo } from "@/server/contratos/aditivo-originais";
import { consultarAssinaturaAditivo, registrarConferenciaAssinaturaAditivo } from "@/server/contratos/aditivo-assinatura";
import { prepararProcessoAditivoTx, iniciarTentativaAditivoTx, registrarResultadoEnvioAditivoTx } from "@/server/contratos/aditivo-envio-tx";
import { preservarConclusaoAssinaturaAditivoTx } from "@/server/contratos/aditivo-conclusao-tx";
import { consultarConferenciaFinalAditivo, registrarConferenciaFinalAditivo } from "@/server/contratos/aditivo-conferencia-final";

const FORNECEDOR = "SIMULADO", AMBIENTE = "SANDBOX" as const;
const MARCA_CONTRATO = "QA-CONTRATO-OK", MARCA_ADITIVO = "QA-ADITIVO-OK";
const TX = { timeout: 60_000, maxWait: 20_000 };
const PAISES = { CR: { nome: "Costa Rica", moeda: "CRC", taxa: "10000" }, PA: { nome: "Panamá", moeda: "USD", taxa: "20" } } as const;
type Sigla = keyof typeof PAISES;
type Estado = "RASCUNHO" | "ENVIADO" | "ASSINADO" | "CANCELADO";
const PLANO: Estado[] = ["RASCUNHO", "ENVIADO", "ASSINADO", "ASSINADO", "ASSINADO", "CANCELADO"];
const contagem: Record<string, number> = {};
const conta = (k: string) => { contagem[k] = (contagem[k] ?? 0) + 1; };

declare global { var __qaSessao: string | undefined } // eslint-disable-line no-var
const entrar = (id: string) => { globalThis.__qaSessao = id; };
function dado<T>(r: { ok: boolean; dado?: T; erro?: string }, etapa: string): T {
  if (!r.ok || r.dado === undefined) throw new Error(`${etapa}: ${r.erro ?? "sem dado"}`);
  return r.dado;
}
const usuario = async (email: string) => (await prisma.usuario.findUniqueOrThrow({ where: { email }, select: { id: true } })).id;

// ---------- modelos ----------
const ModelosArquivo = z.object({ modelos: z.array(z.object({ codigo: z.string(), conteudo: z.record(z.string(), z.unknown()) })) });
async function modelos(secId: string, admId: string) {
  const arq = process.env.QA_MODELOS_JSON;
  if (!arq) throw new Error("Defina QA_MODELOS_JSON (modelos fora do repositório).");
  const { modelos } = ModelosArquivo.parse(JSON.parse(readFileSync(arq, "utf8")));
  const ids: Record<string, { id: string; hash: string }> = {};
  for (const m of modelos) {
    let v = await prisma.versaoModeloContratual.findFirst({ where: { codigo: m.codigo }, orderBy: { versao: "desc" } });
    if (!v) {
      entrar(secId);
      const criado = dado(await prepararModeloContratual({ codigo: m.codigo, versaoEsperada: 0, motivo: "Modelo contratual oficial importado do documento da escola", chaveIdempotencia: `qa-modelo-${m.codigo}`, conteudo: m.conteudo as never }), `modelo ${m.codigo}`);
      v = await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: criado.id } });
      conta("Modelo criado");
    }
    const decidido = await prisma.decisaoModeloContratual.findFirst({ where: { modeloId: v.id } });
    if (!decidido) { entrar(admId); dado(await decidirModeloContratual({ modeloId: v.id, conteudoHash: v.conteudoHash, aprovada: true, motivo: "Modelo conferido e aprovado pela administração" }), `aprovar ${m.codigo}`); }
    ids[m.codigo] = { id: v.id, hash: v.conteudoHash };
  }
  return ids;
}

// ---------- infraestrutura (config, turma, grade, encontro) ----------
async function configuracao() {
  if (await prisma.configuracaoOperacional.count() === 0)
    await prisma.configuracaoOperacional.create({ data: { prazoReservaMinutos: 525600, fusoInstitucional: "America/Costa_Rica", exigirPrimeiraMensalidade: false } });
}

let encontroSeq = 0;
async function turmaContrato(produtoId: string, professorId: string, secId: string, admId: string, calendarioId: string) {
  const produto = await prisma.produto.findUniqueOrThrow({ where: { id: produtoId }, include: { modalidade: true } });
  const id = qaId("turma_contrato", produtoId);
  const existe = await prisma.turma.findUnique({ where: { id } });
  if (existe) return id;
  let nivel = await prisma.nivel.findFirst({ where: { idiomaId: produto.idiomaId }, orderBy: { ordem: "asc" } });
  nivel ??= await prisma.nivel.create({ data: { id: qaId("nivel_contrato", produto.idiomaId), idiomaId: produto.idiomaId, codigo: "QA-CONTRATO", ordem: 99 } });
  await prisma.turma.create({ data: { id, nome: `[QA] Contratos ${produto.modalidade.nome ?? ""}`.trim(), modalidadeId: produto.modalidadeId, nivelId: nivel.id, professorId, capacidade: 40 } });
  const janela = await prisma.janelaAdmissaoTurma.create({ data: { id: qaId("janela_contrato", produtoId), turmaId: id, preparadorId: secId, versao: 1, limiteEntrada: new Date("2099-12-31"), fusoAdmissao: "America/Costa_Rica", motivo: "Janela de QA para contratos", chaveIdempotencia: `qa-janela-${produtoId}`, entradaHash: "qa-seed" } });
  await prisma.decisaoJanelaAdmissao.create({ data: { propostaId: janela.id, decisorId: admId, aprovada: true, motivo: "Janela de QA conferida" } });
  const grade = await prisma.propostaGradeTurma.create({ data: { id: qaId("grade_contrato", produtoId), turmaId: id, calendarioId, preparadorId: secId, versao: 1, fusoOrigem: "America/Costa_Rica", motivo: "Grade de QA para contratos", chaveIdempotencia: `qa-grade-${produtoId}`, entradaHash: "qa-seed", snapshot: {} } });
  await prisma.decisaoGradeTurma.create({ data: { propostaId: grade.id, decisorId: admId, aprovada: true, motivo: "Grade de QA conferida" } });
  const n = encontroSeq++;
  const inicio = new Date(Date.UTC(2026, 10, 2 + n, 4, 17)); // madrugada, sem colidir com a grade real
  await prisma.encontroAgenda.create({ data: { id: qaId("encontro_contrato", produtoId), turmaId: id, propostaGradeId: grade.id, professorId, preparadorId: secId, inicio, fim: new Date(inicio.getTime() + 3_600_000), fusoOrigem: "America/Costa_Rica", status: "PREVISTO", motivo: "Encontro de QA para contratos", chaveIdempotencia: `qa-encontro-${produtoId}`, entradaHash: "qa-seed" } });
  conta("Turma de contratos");
  return id;
}

// ---------- contrato ----------
type Ctx = { secId: string; admId: string; vendId: string; professorId: string; calendarioId: string; modelos: Record<string, { id: string; hash: string }> };
// As ofertas reais ainda não têm política de entrada conferida (taxa antes da assinatura etc.), e a preparação
// comercial é imutável. Para não alterar a configuração real da escola, cada contrato de QA usa uma cópia QA do
// produto da matrícula (mesmo idioma e modalidade, portanto o mesmo plano), com oferta e preços copiados do país e
// política de entrada de turma definida (taxa cobrada após a assinatura, sem exigir pagamento prévio). Tudo com prefixo qa_, removido por cleanup-qa.ts.
async function produtoContrato(produtoId: string, paisId: string) {
  const id = qaId("produto_contrato", produtoId);
  const real = await prisma.produto.findUniqueOrThrow({ where: { id: produtoId } });
  if (!await prisma.produto.findUnique({ where: { id } })) await prisma.produto.create({ data: { id, idiomaId: real.idiomaId, modalidadeId: real.modalidadeId } });
  const ofertaId = qaId("produtopais_contrato", `${produtoId}_${paisId}`);
  if (!await prisma.produtoPais.findUnique({ where: { id: ofertaId } })) {
    const o = await prisma.produtoPais.findUniqueOrThrow({ where: { produtoId_paisId: { produtoId, paisId } } });
    await prisma.produtoPais.create({ data: { id: ofertaId, produtoId: id, paisId, moeda: o.moeda, oferecido: true, formaAgenda: "TURMA", taxaPreviaAssinatura: false, adiantamentoHoraExigido: null, versaoEntrada: 1 } });
    const precos = await prisma.precoReferencia.findMany({ where: { produtoId, paisId, ativo: true } });
    for (const pr of precos) await prisma.precoReferencia.create({ data: { id: qaId("preco_contrato", `${pr.id}`), paisId, produtoId: id, modalidadeId: pr.modalidadeId, tipoCobranca: pr.tipoCobranca, valor: pr.valor, moeda: pr.moeda, ativo: true, versaoEstudo: pr.versaoEstudo } });
  }
  return id;
}

type Candidato = { alunoId: string; produtoId: string; mensalidade: string };

async function candidatos(sigla: Sigla): Promise<Candidato[]> {
  const pais = await prisma.pais.findFirstOrThrow({ where: { nome: PAISES[sigla].nome } });
  const alunos = await prisma.aluno.findMany({
    where: { id: { startsWith: PREFIXO_ID }, paisId: pais.id, email: { not: null }, documento: { not: null }, matriculas: { some: { status: "ENCERRADA" }, every: { status: "ENCERRADA" } } },
    orderBy: { id: "asc" }, include: { matriculas: { orderBy: { criadoEm: "desc" }, take: 1, include: { cobrancas: { where: { tipo: "MENSALIDADE" }, orderBy: { vencimento: "desc" }, take: 1 } } } },
  });
  // Alunos que já receberam contrato de QA (re-execução) continuam elegíveis.
  const comContrato = await prisma.aluno.findMany({ where: { id: { startsWith: PREFIXO_ID }, paisId: pais.id, matriculas: { some: { leadId: { startsWith: qaId("lead_contrato", "") } } } }, orderBy: { id: "asc" }, include: { matriculas: { where: { status: "ENCERRADA" }, orderBy: { criadoEm: "desc" }, take: 1, include: { cobrancas: { where: { tipo: "MENSALIDADE" }, orderBy: { vencimento: "desc" }, take: 1 } } } } });
  const todos = [...comContrato, ...alunos.filter(a => !comContrato.some(c => c.id === a.id))];
  const out: Candidato[] = [];
  for (const a of todos) {
    const m = a.matriculas[0]; if (!m) continue;
    const c = m.cobrancas[0];
    let mensalidade = c && c.moeda === PAISES[sigla].moeda ? c.valorNegociado.toFixed(2) : null;
    if (!mensalidade) {
      const prod = await prisma.produto.findUniqueOrThrow({ where: { id: m.produtoId } });
      const ref = await prisma.precoReferencia.findFirst({ where: { produtoId: m.produtoId, modalidadeId: prod.modalidadeId, paisId: pais.id, tipoCobranca: "MENSALIDADE", ativo: true, moeda: PAISES[sigla].moeda } });
      mensalidade = ref ? ref.valor.toFixed(2) : null;
    }
    if (mensalidade && Number(mensalidade) > 0) out.push({ alunoId: a.id, produtoId: m.produtoId, mensalidade });
    if (out.length === PLANO.length) break;
  }
  if (out.length < PLANO.length) throw new Error(`Alunos insuficientes para ${sigla}: ${out.length}`);
  return out;
}

async function original(ctx: Ctx, matriculaId: string, alunoId: string, modeloId: string, chave: string) {
  entrar(ctx.secId);
  const consulta = { matriculaId, modeloId };
  const revisao = dado(await consultarPreenchimentoContratual(consulta), "preenchimento");
  const previa = dado(await registrarPreviaContratual({ ...consulta, revisaoHash: revisao.revisaoHash, aplicacaoConferida: true, motivo: "Aplicação do modelo conferida pela secretaria", chaveIdempotencia: `${chave}-previa` }), "prévia");
  const p = await prisma.aluno.findUniqueOrThrow({ where: { id: alunoId } });
  const participantes = dado(await conferirParticipantesContratuais({ previaId: previa.id, versaoEsperada: 0, maioridade: null,
    participantes: [{ papel: "ALUNO", identidade: { nome: [p.primeiroNome, p.sobrenome].filter(Boolean).join(" "), email: p.email!, documento: p.documento! } }],
    identificacoesConferidas: true, motivo: "Identidade do aluno conferida", chaveIdempotencia: `${chave}-participantes` }), "participantes");
  const artefato = dado(await preservarOriginalContratual({ previaId: previa.id, conferenciaId: participantes.id, conteudoConferido: true, motivo: "Original contratual conferido" }), "original");
  const alvo = { matriculaId, artefatoId: artefato.id };
  const ass = dado(await consultarConferenciaAssinatura(alvo), "consulta assinatura");
  if (!ass.revisao) throw new Error(`revisão de assinatura indisponível (${chave}): ${ass.pendencia}`);
  const conf = dado(await registrarConferenciaAssinatura({ ...alvo, revisaoHash: ass.revisao.hash, dadosConferidos: true, motivo: "Assinatura apta para envio simulado", chaveIdempotencia: `${chave}-assinatura` }), "conferência assinatura");
  return { artefatoId: artefato.id, conferenciaId: conf.id, revisaoHash: ass.revisao.hash };
}

async function contrato(ctx: Ctx, sigla: Sigla, c: Candidato, estado: Estado, idx: number) {
  const leadId = qaId("lead_contrato", c.alunoId);
  const lead = await prisma.oportunidade.findUnique({ where: { id: leadId }, include: { matricula: true } });
  if (lead?.objetivo === MARCA_CONTRATO && lead.matricula) { conta(`Contrato ${sigla} ${estado} (existente)`); return { matriculaId: lead.matricula.id, alunoId: c.alunoId, estado }; }
  if (lead?.matricula) throw new Error(`Cadeia contratual incompleta em ${leadId}: rode cleanup-qa.ts e o seed novamente.`);
  const aluno = await prisma.aluno.findUniqueOrThrow({ where: { id: c.alunoId } });
  const pais = PAISES[sigla];
  await prisma.oportunidade.upsert({ where: { id: leadId }, update: {}, create: { id: leadId, nome: `[QA] Contrato ${aluno.primeiroNome} ${aluno.sobrenome ?? ""}`.trim(), vendedorDonoId: ctx.vendId, paisId: aluno.paisId } });
  const turmaId = await turmaContrato(c.produtoId, ctx.professorId, ctx.secId, ctx.admId, ctx.calendarioId);
  const k = `qa-ct-${c.alunoId}`;
  const produtoId = await produtoContrato(c.produtoId, aluno.paisId);
  const prep = await prisma.$transaction(tx => prepararContratacaoTx(tx, { autorId: ctx.secId, leadId, alunoId: c.alunoId, produtoId, paisId: aluno.paisId, turmaId, regime: "MENSALIDADE", taxaProposta: pais.taxa, valorServicoProposto: c.mensalidade, motivo: "Contratação de QA com plano e preço da matrícula anterior", chaveIdempotencia: `${k}-preparacao` }), TX);
  const matriculaId = prep.matriculaId;
  const prod = await prisma.produto.findUniqueOrThrow({ where: { id: produtoId } });
  const refs = await prisma.precoReferencia.findMany({ where: { produtoId, modalidadeId: prod.modalidadeId, paisId: aluno.paisId, ativo: true } });
  const abaixo = refs.some(r => (r.tipoCobranca === "MENSALIDADE" && Number(c.mensalidade) < Number(r.valor)) || (r.tipoCobranca === "TAXA_MATRICULA" && Number(pais.taxa) < Number(r.valor)));
  if (abaixo && !(await prisma.decisaoPrecoPreparacao.findFirst({ where: { preparacaoId: prep.id } })))
    await prisma.decisaoPrecoPreparacao.create({ data: { preparacaoId: prep.id, decisorId: ctx.admId, aprovada: true, motivo: "Preço da matrícula anterior mantido (QA)" } });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { secretariaAssumiuEm: new Date(), secretariaResponsavelId: ctx.secId } });
  entrar(ctx.secId);
  const pagador = dado(await registrarPagadorPreparacao({ matriculaId, versaoEsperada: 0, pagador: { tipo: "ALUNO" }, motivo: "Aluno pagador conferido", chaveIdempotencia: `${k}-pagador` }), "pagador");
  dado(await registrarCondicoesEntrada({ matriculaId, pagadorRegistroId: pagador.id, versaoEsperada: 0, taxaVencimento: "2026-10-30", aulas: { regime: "MENSALIDADE", cobertura: { referencia: "MES_CIVIL", inicio: "2026-11-01" }, primeiroVencimento: "2026-11-05", diaVencimentoContratado: 5 }, motivo: "Condições da contratação conferidas", chaveIdempotencia: `${k}-condicoes` }), "condições");
  const rev = dado(await consultarRevisaoEmissao(matriculaId), "revisão emissão");
  dado(await conferirEEmitirEntrada({ matriculaId, revisaoHash: rev.hash, cadastroDocumentosConferidos: true, condicoesConferidas: true, motivo: "Emissão inicial conferida", chaveIdempotencia: `${k}-emissao` }), "emissão");
  const modeloId = ctx.modelos[`CONTRATO-${sigla}`]!.id;
  const fonte = await original(ctx, matriculaId, c.alunoId, modeloId, `${k}-fonte`);
  if (estado !== "RASCUNHO") {
    const processo = await prisma.$transaction(tx => prepararProcessoEnvioTx(tx, { matriculaId, artefatoId: fonte.artefatoId, conferenciaId: fonte.conferenciaId, executorId: ctx.secId, fornecedor: FORNECEDOR, ambiente: AMBIENTE }), TX);
    const tentativa = await prisma.$transaction(tx => iniciarTentativaAssinaturaTx(tx, { processoId: processo.id, executorId: ctx.secId }), TX);
    const ref = referenciaSimulada(`${k}-envio`);
    await prisma.$transaction(tx => registrarResultadoEnvioTx(tx, { processoId: processo.id, tentativaId: tentativa.tentativaId, chave: `${k}-envio`, resultado: "REGISTRADO", referenciaExterna: ref, evidenciaHash: "a".repeat(64) }), TX);
    if (estado === "ASSINADO") {
      const p = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: processo.id }, include: { artefato: { include: { conferencia: true } }, tentativas: { orderBy: { numero: "desc" }, take: 1 } } });
      const snap = z.object({ participantes: z.array(z.object({ papel: z.literal("ALUNO"), identidade: IdentidadeSignatarioSchema })) }).parse(p.artefato.conferencia.snapshot);
      const quando = p.tentativas[0]!.iniciadaEm.toISOString();
      await prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, { processoId: processo.id, referenciaExterna: ref, originalHash: p.artefato.pdfHash, concluidaEm: quando, pdfAssinado: Buffer.from(`%PDF-QA assinatura SIMULADA ${k}`), evidencias: Buffer.from(`Evidência SIMULADA de QA (sem envio externo) ${k}`), assinaturas: snap.participantes.map(x => ({ papel: x.papel, identidadeHash: hashPrevia(x.identidade), referenciaAssinatura: `${k}-${x.papel}`, assinadaEm: quando })) }), TX);
    }
    if (estado === "CANCELADO") {
      // Reemissão: o envio é cancelado (simulado) e um substituto preparado; nenhum dado do aluno é alterado.
      const sub = await original(ctx, matriculaId, c.alunoId, modeloId, `${k}-substituto`);
      const proposta = await prisma.$transaction(tx => prepararSubstituicaoContratualTx(tx, ctx.secId, { processoFonteId: processo.id, conferenciaSubstitutoId: sub.conferenciaId, revisaoFonteEsperada: fonte.revisaoHash, revisaoSubstitutoEsperada: sub.revisaoHash, motivo: "Reemissão do contrato solicitada pelo aluno (QA)", chaveIdempotencia: `${k}-substituicao` }), TX);
      await prisma.$transaction(tx => decidirSubstituicaoContratualTx(tx, ctx.admId, { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, aprovada: true, motivo: "Substituição conferida pela administração" }), TX);
      const intencao = await prisma.$transaction(tx => iniciarCancelamentoAssinaturaTx(tx, ctx.secId, { propostaId: proposta.id, propostaHash: proposta.propostaHash }), TX);
      const obs = await prisma.$transaction(tx => registrarObservacaoCancelamentoTx(tx, { intencaoId: intencao.id, processoId: processo.id, propostaId: proposta.id, chave: `${k}-cancelamento`, resultado: "CONFIRMADO", referenciaExterna: ref, evidenciaHash: "d".repeat(64) }), TX);
      await prisma.$transaction(tx => aplicarSubstituicaoContratualTx(tx, ctx.secId, { intencaoId: intencao.id, observacaoId: obs.id, propostaHash: proposta.propostaHash, matriculaId, artefatoId: sub.artefatoId, conferenciaId: sub.conferenciaId, fornecedor: FORNECEDOR, ambiente: AMBIENTE }), TX);
    }
  }
  await prisma.oportunidade.update({ where: { id: leadId }, data: { objetivo: MARCA_CONTRATO } });
  conta(`Contrato ${sigla} ${estado}`); void idx;
  return { matriculaId, alunoId: c.alunoId, estado };
}

// ---------- aditivos ----------
type Alteracao = { origem: string; novo: string; valorEstruturado?: Record<string, string> };
type DesfechoAditivo = "RASCUNHO" | "RECUSADO" | "APROVADO" | "ENVIADO" | "ASSINADO";
type PlanoAditivo = { tipo: string; desfecho: DesfechoAditivo; alteracoes: Alteracao[]; ciclo?: Record<string, string> };
const dinheiro = (origem: string, valor: string, moeda: string): Alteracao => ({ origem, novo: `${Number(valor).toFixed(2)} ${moeda}`, valorEstruturado: { tipo: "DINHEIRO", valor, moeda } });
const data = (origem: string, d: string): Alteracao => ({ origem, novo: d, valorEstruturado: { tipo: "DATA", data: d } });

async function aditivo(ctx: Ctx, sigla: Sigla, alvo: { matriculaId: string; alunoId: string }, plano: PlanoAditivo) {
  const leadId = qaId("lead_contrato", alvo.alunoId);
  if ((await prisma.oportunidade.findUniqueOrThrow({ where: { id: leadId } })).urgencia === MARCA_ADITIVO) { conta(`Aditivo ${sigla} ${plano.tipo} ${plano.desfecho} (existente)`); return; }
  const k = `qa-ad-${alvo.alunoId}`;
  const conclusao = await prisma.conclusaoAssinaturaContratual.findFirstOrThrow({ where: { processo: { matriculaId: alvo.matriculaId } } });
  const modelo = ctx.modelos[`ADENDA-${sigla}`]!;
  const proposta = await prisma.$transaction(tx => prepararAditivoContratualTx(tx, ctx.secId, { matriculaId: alvo.matriculaId, conclusaoOriginalId: conclusao.id, conclusaoHashEsperado: conclusao.entradaHash, modeloId: modelo.id, modeloHashEsperado: modelo.hash, vigenciaInicio: "2026-12-01T00:00:00-06:00", alteracoes: plano.alteracoes, motivo: `Adenda de ${plano.tipo} acordada com o aluno (QA)`, chaveIdempotencia: `${k}-proposta`, ...(plano.ciclo ? { cicloCoberturaFutura: plano.ciclo } : {}) }), TX);
  if (plano.desfecho !== "RASCUNHO") {
    await prisma.$transaction(tx => decidirAditivoContratualTx(tx, ctx.admId, { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, aprovada: plano.desfecho !== "RECUSADO", motivo: plano.desfecho === "RECUSADO" ? "Valor recusado pela administração (QA)" : "Condições da adenda conferidas pela administração" }), TX);
  }
  if (!["RASCUNHO", "RECUSADO"].includes(plano.desfecho)) {
    entrar(ctx.admId);
    const soVencimento = plano.alteracoes.every(a => a.origem === "PRIMEIRA_MENSALIDADE_VENCIMENTO");
    for (const alcada of (soVencimento ? ["FINANCEIRA"] : ["FINANCEIRA", "COMERCIAL"]) as ("FINANCEIRA" | "COMERCIAL")[])
      dado(await decidirAlcadaAditivo({ matriculaId: alvo.matriculaId, propostaId: proposta.id, propostaHash: proposta.propostaHash, alcada, aprovada: true, motivo: "Alçada conferida de forma independente" }), `alçada ${alcada}`);
  }
  if (["ENVIADO", "ASSINADO"].includes(plano.desfecho)) {
    const a = await prisma.aluno.findUniqueOrThrow({ where: { id: alvo.alunoId } });
    entrar(ctx.secId);
    const conf = await prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, ctx.secId, { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, versaoEsperada: 0, maioridade: null, participantes: [{ papel: "ALUNO", identidade: { nome: [a.primeiroNome, a.sobrenome].filter(Boolean).join(" "), email: a.email!, documento: a.documento! } }], identificacoesConferidas: true, motivo: "Identificação conferida para a adenda", chaveIdempotencia: `${k}-participantes` }), TX);
    const orig = dado(await preservarOriginalAditivo({ matriculaId: alvo.matriculaId, propostaId: proposta.id, conferenciaId: conf.id, conferenciaHash: conf.revisaoHash, motivo: "Original da adenda conferido", conteudoConferido: true }), "original aditivo");
    const al = { matriculaId: alvo.matriculaId, propostaId: proposta.id, artefatoId: orig.id };
    const rev = dado(await consultarAssinaturaAditivo(al), "consulta assinatura aditivo");
    if (!rev.revisao) throw new Error("revisão de assinatura do aditivo indisponível");
    const ass = dado(await registrarConferenciaAssinaturaAditivo({ ...al, revisaoHash: rev.revisao.hash, dadosConferidos: true, motivo: "Original e assinaturas da adenda conferidos", chaveIdempotencia: `${k}-assinatura` }), "conferência assinatura aditivo");
    const proc = await prisma.$transaction(tx => prepararProcessoAditivoTx(tx, ctx.secId, { ...al, conferenciaId: ass.id, fornecedor: FORNECEDOR, ambiente: AMBIENTE }), TX);
    const tent = await prisma.$transaction(tx => iniciarTentativaAditivoTx(tx, ctx.secId, { processoId: proc.id }), TX);
    const ref = referenciaSimulada(`${k}-envio`);
    await prisma.$transaction(tx => registrarResultadoEnvioAditivoTx(tx, { processoId: proc.id, tentativaId: tent.tentativaId, chave: `${k}-envio`, resultado: "REGISTRADO", referenciaExterna: ref, evidenciaHash: "a".repeat(64) }), TX);
    if (plano.desfecho === "ASSINADO") {
      const art = await prisma.artefatoAditivoContratual.findUniqueOrThrow({ where: { id: orig.id }, include: { conferencia: true } });
      const part = z.object({ participantes: z.array(z.object({ papel: z.literal("ALUNO"), identidade: IdentidadeSignatarioSchema })) }).parse(art.conferencia.snapshot).participantes;
      const quando = (await prisma.tentativaEnvioAditivo.findUniqueOrThrow({ where: { id: tent.tentativaId } })).iniciadaEm.toISOString();
      const concl = await prisma.$transaction(tx => preservarConclusaoAssinaturaAditivoTx(tx, { processoId: proc.id, referenciaExterna: ref, originalHash: art.pdfHash, concluidaEm: quando, pdfAssinado: Buffer.from(`%PDF-QA adenda assinatura SIMULADA ${k}`), evidencias: Buffer.from(`Evidência SIMULADA de QA ${k}`), assinaturas: part.map(p => ({ papel: p.papel, identidadeHash: hashPrevia(p.identidade), referenciaAssinatura: `${k}-${p.papel}`, assinadaEm: quando })) }), TX);
      const fa = { matriculaId: alvo.matriculaId, propostaId: proposta.id, conclusaoId: concl.id };
      const rf = dado(await consultarConferenciaFinalAditivo(fa), "consulta conferência final");
      if (!rf.revisao) throw new Error("revisão final do aditivo indisponível");
      dado(await registrarConferenciaFinalAditivo({ ...fa, revisaoHash: rf.revisao.hash, documentoConferido: true, evidenciasConferidas: true, motivo: "Conclusão da adenda conferida" }), "conferência final");
    }
  }
  await prisma.oportunidade.update({ where: { id: leadId }, data: { urgencia: MARCA_ADITIVO } });
  conta(`Aditivo ${sigla} ${plano.tipo} ${plano.desfecho}`);
}

function planosAditivo(sigla: Sigla, mensalidades: string[]): PlanoAditivo[] {
  const m = (i: number, f: number) => (Math.round(Number(mensalidades[i]) * f * 100) / 100).toFixed(2);
  if (sigla === "CR") return [
    { tipo: "valor", desfecho: "ASSINADO", alteracoes: [dinheiro("MENSALIDADE_VALOR", m(0, 1.1), "CRC")] },
    { tipo: "vencimento", desfecho: "ENVIADO", alteracoes: [data("PRIMEIRA_MENSALIDADE_VENCIMENTO", "2026-11-15")] },
    { tipo: "moeda (Q173)", desfecho: "APROVADO", alteracoes: [{ origem: "MOEDA", novo: "USD", valorEstruturado: { tipo: "MOEDA", moeda: "USD" } }, dinheiro("TAXA_VALOR", "20", "USD"), dinheiro("MENSALIDADE_VALOR", (Math.max(1, Math.round(Number(mensalidades[2]) / 500))).toFixed(2), "USD")] },
  ];
  return [
    { tipo: "mudança de plano", desfecho: "ASSINADO", alteracoes: [data("COBERTURA_INICIO", "2026-12-10"), data("COBERTURA_FIM", "2027-01-09"), dinheiro("MENSALIDADE_VALOR", m(0, 1.25), "USD")], ciclo: { escolha: "MUDAR_REFERENCIA", referencia: "CICLO_MATRICULA", dataReferencia: "2026-12-10" } },
    { tipo: "pausa (deslocamento de cobertura)", desfecho: "RASCUNHO", alteracoes: [data("COBERTURA_INICIO", "2027-01-01"), data("COBERTURA_FIM", "2027-01-31")], ciclo: { escolha: "PRESERVAR_REFERENCIA" } },
    { tipo: "valor", desfecho: "RECUSADO", alteracoes: [dinheiro("MENSALIDADE_VALOR", m(2, 0.8), "USD")] },
  ];
}

async function main() {
  const secId = await usuario("secretaria@genius.com"), admId = await usuario("admin@genius.com"), vendId = await usuario("joao@genius.com");
  const professor = await prisma.usuario.findFirstOrThrow({ where: { id: { startsWith: PREFIXO_ID }, papeis: { has: "PROFESSOR" } }, orderBy: { id: "asc" } });
  const calendario = await prisma.versaoCalendarioEscolar.findFirstOrThrow({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" } });
  await configuracao();
  const ctx: Ctx = { secId, admId, vendId, professorId: professor.id, calendarioId: calendario.id, modelos: await modelos(secId, admId) };
  for (const sigla of ["CR", "PA"] as Sigla[]) {
    const cands = await candidatos(sigla);
    const feitos = [];
    for (let i = 0; i < PLANO.length; i++) feitos.push(await contrato(ctx, sigla, cands[i]!, PLANO[i]!, i));
    const assinados = feitos.map((f, i) => ({ ...f, mensalidade: cands[i]!.mensalidade })).filter(f => f.estado === "ASSINADO");
    const planos = planosAditivo(sigla, assinados.map(a => a.mensalidade));
    for (let i = 0; i < planos.length; i++) await aditivo(ctx, sigla, assinados[i]!, planos[i]!);
  }
  console.log("Seed de contratos QA concluído:");
  for (const [k, v] of Object.entries(contagem).sort()) console.log(`  ${k}: ${v}`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
