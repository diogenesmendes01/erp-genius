import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { prepararFixtureSubstituicaoContratual } from "@/test/substituicao-contratual";
import { decidirSubstituicaoContratualTx, prepararSubstituicaoContratualTx } from "./substituicao-tx";
import { consultarPropostaSubstituicao, consultarSubstituicoesContratuais, decidirSubstituicaoContratual, prepararSubstituicaoContratual } from "./substituicao";
import { iniciarCancelamentoAssinaturaTx, registrarObservacaoCancelamentoTx } from "./cancelamento-assinatura-tx";
import { preservarConclusaoAssinaturaTx } from "./conclusao-assinatura-tx";
import { IdentidadeSignatarioSchema } from "./participantes-schema";
import { hashPrevia } from "./previa-estado";
import { z } from "zod";
import { prepararProcessoEnvioTx, iniciarTentativaAssinaturaTx, registrarResultadoEnvioTx } from "./envio-tx";

let base: Awaited<ReturnType<typeof prepararFixtureSubstituicaoContratual>>;
const entrada = () => ({ processoFonteId: base.processoId, conferenciaSubstitutoId: base.conferenciaSubstitutoId,
  revisaoFonteEsperada: base.revisaoFonteHash, revisaoSubstitutoEsperada: base.revisaoSubstitutoHash,
  motivo: "Corrigir os dados identificados no contrato", chaveIdempotencia: "substituicao-um" });
const preparar = () => prisma.$transaction(tx => prepararSubstituicaoContratualTx(tx, base.secretariaId, entrada()), { timeout: 20000 });
const decidir = (p: { id: string; propostaHash: string }, aprovada = true, autorId = base.adminId) => prisma.$transaction(tx => decidirSubstituicaoContratualTx(tx, autorId, {
  propostaId: p.id, propostaHashEsperado: p.propostaHash, aprovada, motivo: "Diferenças e condições conferidas",
}), { timeout: 20000 });

beforeEach(async () => { await truncarBanco(); base = await prepararFixtureSubstituicaoContratual(authMock); });

it("prepara e aprova independentemente, preservando fonte enviada e cobranças", async () => {
  const cobrancas = await prisma.cobranca.findMany({ orderBy: { id: "asc" } });
  const p = await preparar();
  expect(await preparar()).toEqual(p);
  const d = await decidir(p); expect(await decidir(p)).toEqual(d);
  expect(await prisma.propostaSubstituicaoContratual.count()).toBe(1);
  expect(await prisma.decisaoSubstituicaoContratual.count()).toBe(1);
  expect(await prisma.processoAssinaturaContratual.findUnique({ where: { id: base.processoId } })).toMatchObject({ estado: "ENVIADO", artefatoId: base.artefatoFonteId, referenciaExterna: base.referenciaExternaFonte });
  expect(await prisma.processoAssinaturaContratual.count()).toBe(1);
  expect(await prisma.cobranca.findMany({ orderBy: { id: "asc" } })).toEqual(cobrancas);
  await expect(prisma.propostaSubstituicaoContratual.update({ where: { id: p.id }, data: { motivo: "Outro motivo posterior" } })).rejects.toThrow("imutável");
  await expect(prisma.decisaoSubstituicaoContratual.delete({ where: { id: d.id } })).rejects.toThrow("imutável");
});

it("nega autoaprovação no serviço e no banco mesmo com acúmulo de papéis", async () => {
  await prisma.usuario.update({ where: { id: base.secretariaId }, data: { papeis: ["SECRETARIA_ACADEMICA", "ADMINISTRADOR"] } });
  const p = await preparar();
  await expect(decidir(p, true, base.secretariaId)).rejects.toThrow("Outra pessoa");
  await expect(prisma.decisaoSubstituicaoContratual.create({ data: { propostaId: p.id, decisorId: base.secretariaId, aprovada: true, motivo: "Tentativa direta indevida", propostaHash: p.propostaHash } })).rejects.toThrow("outro administrador");
  expect(await prisma.decisaoSubstituicaoContratual.count()).toBe(0);
});

it("rejeita hash errado, chave reaproveitada e aprovação de versão superada", async () => {
  const p = await preparar();
  await expect(decidir({ ...p, propostaHash: "0".repeat(64) })).rejects.toThrow("proposta revisada");
  await expect(prisma.$transaction(tx => prepararSubstituicaoContratualTx(tx, base.secretariaId, { ...entrada(), motivo: "Outra intenção com mesma chave" }))).rejects.toThrow("Chave");
  const nova = await prisma.$transaction(tx => prepararSubstituicaoContratualTx(tx, base.secretariaId, { ...entrada(), chaveIdempotencia: "substituicao-dois", motivo: "Nova revisão da proposta anterior" }), { timeout: 20000 });
  expect(nova.versao).toBe(2);
  await expect(decidir(p)).rejects.toThrow("mais recente");
  expect(await decidir(p, false)).toMatchObject({ aprovada: false });
});

it("revogação do aprovador impede decisão e chamadas concorrentes não duplicam proposta", async () => {
  const resultados = await Promise.all([preparar(), preparar()]);
  expect(resultados[0]).toEqual(resultados[1]);
  await prisma.usuario.update({ where: { id: base.adminId }, data: { ativo: false } });
  await expect(decidir(resultados[0])).rejects.toThrow();
  const vendedor = await criarUsuario(["VENDEDOR"]);
  await expect(prisma.$transaction(tx => prepararSubstituicaoContratualTx(tx, vendedor.id, entrada()))).rejects.toThrow();
  expect(await prisma.decisaoSubstituicaoContratual.count()).toBe(0);
});

it("alteração dos dados após proposta bloqueia aprovação e permite rejeição histórica", async () => {
  const p = await preparar();
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId } });
  await prisma.aluno.update({ where: { id: matricula.alunoId }, data: { sobrenome: "Nova correção depois da proposta" } });
  await expect(decidir(p)).rejects.toThrow();
  expect(await prisma.decisaoSubstituicaoContratual.count()).toBe(0);
  expect(await decidir(p, false)).toMatchObject({ aprovada: false });
});

it("ações autenticadas permitem preparar pela Secretaria e decidir por outro administrador", async () => {
  const lista = await consultarSubstituicoesContratuais({ matriculaId: base.matriculaId });
  expect(lista).toMatchObject({ ok: true, dado: { podePreparar: true, conferencias: [{ id: base.conferenciaSubstitutoId }] } });
  const preparada = await prepararSubstituicaoContratual(entrada());
  if (!preparada.ok || !preparada.dado) throw new Error(JSON.stringify(preparada));
  const p = preparada.dado;
  const decisao = { propostaId: p.id, propostaHashEsperado: p.propostaHash, aprovada: true, motivo: "Conferência administrativa independente" };
  expect(await decidirSubstituicaoContratual(decisao)).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: base.adminId } });
  const detalhe = await consultarPropostaSubstituicao({ matriculaId: base.matriculaId, propostaId: p.id });
  expect(detalhe).toMatchObject({ ok: true, dado: { podeDecidir: true, fonte: { texto: { documento: { titulo: "Contrato Aluno Original" } } }, substituto: { texto: { documento: { titulo: "Contrato Aluno Corrigido" } } } } });
  expect(await decidirSubstituicaoContratual(decisao)).toMatchObject({ ok: true, dado: { aprovada: true } });
});

it("não expõe referência externa, entrada idempotente, PDF ou snapshots internos nas consultas", async () => {
  const p = await preparar();
  const lista = await consultarSubstituicoesContratuais({ matriculaId: base.matriculaId });
  const detalhe = await consultarPropostaSubstituicao({ matriculaId: base.matriculaId, propostaId: p.id });
  for (const resposta of [lista, detalhe]) {
    expect(resposta.ok).toBe(true);
    const texto = JSON.stringify(resposta);
    for (const campo of ["referenciaExterna", "chaveIdempotencia", "preparadaPorId", "snapshot", "pdfHash", "baseHash", "Buffer"])
      expect(texto).not.toContain(`"${campo}"`);
    expect(texto).not.toContain(base.referenciaExternaFonte);
  }
  expect(await consultarPropostaSubstituicao({ matriculaId: "outra-matricula", propostaId: p.id })).toMatchObject({ ok: false });
});

it("nega consultas e mutações a vendedor, professor, financeiro e sessão revogada", async () => {
  const p = await preparar();
  for (const papel of ["VENDEDOR", "PROFESSOR", "FINANCEIRO"] as const) {
    const usuario = await criarUsuario([papel]); authMock.mockResolvedValue({ user: { id: usuario.id } });
    expect(await consultarSubstituicoesContratuais({ matriculaId: base.matriculaId })).toMatchObject({ ok: false });
    expect(await consultarPropostaSubstituicao({ matriculaId: base.matriculaId, propostaId: p.id })).toMatchObject({ ok: false });
    expect(await prepararSubstituicaoContratual(entrada())).toMatchObject({ ok: false });
    expect(await decidirSubstituicaoContratual({ propostaId: p.id, propostaHashEsperado: p.propostaHash, aprovada: true, motivo: "Tentativa sem papel autorizado" })).toMatchObject({ ok: false });
  }
  authMock.mockResolvedValue({ user: { id: base.secretariaId } });
  await prisma.usuario.update({ where: { id: base.secretariaId }, data: { ativo: false } });
  expect(await consultarSubstituicoesContratuais({ matriculaId: base.matriculaId })).toMatchObject({ ok: false });
  expect(await prepararSubstituicaoContratual(entrada())).toMatchObject({ ok: false });
  expect(await prisma.decisaoSubstituicaoContratual.count()).toBe(0);
});

const iniciar = (p: { id: string; propostaHash: string }) => prisma.$transaction(tx => iniciarCancelamentoAssinaturaTx(tx, base.secretariaId, { propostaId: p.id, propostaHash: p.propostaHash }), { timeout: 20000 });
const observacao = (id: string, propostaId: string, resultado: "CONFIRMADO" | "INCERTO", chave = "observacao-primeira") => ({ intencaoId: id, processoId: base.processoId, propostaId, resultado, chave, referenciaExterna: base.referenciaExternaFonte, evidenciaHash: "d".repeat(64) });
async function concluirFonte() {
  const processo = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: base.processoId }, include: { artefato: { include: { conferencia: true } } } });
  const snapshot = z.object({ participantes: z.array(z.object({ identidade: IdentidadeSignatarioSchema })) }).parse(processo.artefato.conferencia.snapshot);
  const agora = new Date().toISOString();
  return prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, { processoId: processo.id, referenciaExterna: base.referenciaExternaFonte, originalHash: processo.artefato.pdfHash,
    concluidaEm: agora, pdfAssinado: Buffer.from("%PDF-evidência simulada de assinatura"), evidencias: Buffer.from("auditoria simulada"),
    assinaturas: [{ papel: "ALUNO", identidadeHash: hashPrevia(snapshot.participantes[0].identidade), referenciaAssinatura: "assinatura-concorrente", assinadaEm: agora }] }));
}

it("intenção exige aprovação e duas chamadas concorrentes criam uma única solicitação durável", async () => {
  const p = await preparar();
  await expect(iniciar(p)).rejects.toThrow("aprovação independente");
  await decidir(p);
  const resultados = await Promise.all([iniciar(p), iniciar(p)]);
  expect(resultados.filter(r => r.nova)).toHaveLength(1);
  expect(resultados[0].id).toBe(resultados[1].id);
  expect(await prisma.intencaoCancelamentoAssinatura.count()).toBe(1);
  expect(await prisma.observacaoCancelamentoAssinatura.count()).toBe(0);
  await expect(prisma.intencaoCancelamentoAssinatura.update({ where: { id: resultados[0].id }, data: { referenciaExterna: "alterada" } })).rejects.toThrow("imutável");
});

it("resultado incerto é conciliado na mesma intenção sem liberar novo envio ou duplicar evidências", async () => {
  const p = await preparar(); await decidir(p); const i = await iniciar(p);
  const incerto = observacao(i.id, p.id, "INCERTO");
  const salvar = (d: typeof incerto) => prisma.$transaction(tx => registrarObservacaoCancelamentoTx(tx, d));
  const r = await salvar(incerto);
  expect(await salvar(incerto)).toEqual(r);
  expect(r).toMatchObject({ cancelamentoConfirmado: false, liberacaoSubstituto: false });
  expect(await iniciar(p)).toMatchObject({ id: i.id, nova: false });
  await expect(salvar({ ...incerto, resultado: "CONFIRMADO" })).rejects.toThrow("Chave");
  const confirmado = await salvar(observacao(i.id, p.id, "CONFIRMADO", "observacao-conciliada"));
  expect(confirmado).toMatchObject({ cancelamentoConfirmado: true, conclusaoConcorrente: false, liberacaoSubstituto: false });
  expect(await prisma.observacaoCancelamentoAssinatura.count()).toBe(2);
  expect(await prisma.processoAssinaturaContratual.findUnique({ where: { id: base.processoId } })).toMatchObject({ estado: "ENVIADO" });
  expect(await prisma.processoAssinaturaContratual.count()).toBe(1);
});

it("não aceita evidência de outra intenção, processo, proposta ou referência", async () => {
  const p = await preparar(); await decidir(p); const i = await iniciar(p);
  const d = observacao(i.id, p.id, "CONFIRMADO");
  for (const alteracao of [{ intencaoId: "outra" }, { processoId: "outro" }, { propostaId: "outra" }, { referenciaExterna: "outra" }]) {
    await expect(prisma.$transaction(tx => registrarObservacaoCancelamentoTx(tx, { ...d, ...alteracao }))).rejects.toThrow("incompatível");
  }
  await expect(prisma.observacaoCancelamentoAssinatura.create({ data: { intencaoId: i.id, chave: "direta-incorreta", resultado: "CONFIRMADO", referenciaExterna: "outra", evidenciaHash: "d".repeat(64) } })).rejects.toThrow("não corresponde");
  expect(await prisma.observacaoCancelamentoAssinatura.count()).toBe(0);
});

it("preserva confirmação externa com conclusão concorrente e não libera substituto", async () => {
  const p = await preparar(); await decidir(p); const i = await iniciar(p);
  const conclusao = await concluirFonte();
  const r = await prisma.$transaction(tx => registrarObservacaoCancelamentoTx(tx, observacao(i.id, p.id, "CONFIRMADO")));
  expect(r).toMatchObject({ cancelamentoConfirmado: true, conclusaoConcorrente: true, liberacaoSubstituto: false });
  expect(await prisma.conclusaoAssinaturaContratual.findUnique({ where: { id: conclusao.id } })).not.toBeNull();
  expect(await prisma.processoAssinaturaContratual.count()).toBe(1);
  await expect(prisma.observacaoCancelamentoAssinatura.delete({ where: { id: r.id } })).rejects.toThrow("imutável");
});

it("conclusão antes da intenção e mudança após aprovação impedem solicitação remota", async () => {
  const p = await preparar(); await decidir(p);
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId } });
  await prisma.aluno.update({ where: { id: matricula.alunoId }, data: { sobrenome: "Mudou após aprovação" } });
  await expect(iniciar(p)).rejects.toThrow();
  await concluirFonte();
  await expect(iniciar(p)).rejects.toThrow("Q117");
  expect(await prisma.intencaoCancelamentoAssinatura.count()).toBe(0);
});

async function confirmacaoParaAplicar() {
  const p = await preparar(); await decidir(p); const i = await iniciar(p);
  const o = await prisma.$transaction(tx => registrarObservacaoCancelamentoTx(tx, observacao(i.id, p.id, "CONFIRMADO")));
  return { matriculaId: base.matriculaId, artefatoId: base.artefatoSubstitutoId, conferenciaId: base.conferenciaSubstitutoId,
    executorId: base.secretariaId, fornecedor: "ZAPSIGN" as const, ambiente: "SANDBOX" as const,
    substituicao: { intencaoId: i.id, observacaoId: o.id, propostaHash: p.propostaHash } };
}

it("consome confirmação criando novo processo uma vez, sem herdar referência ou assinaturas", async () => {
  const d = await confirmacaoParaAplicar();
  const cobrancas = await prisma.cobranca.findMany({ orderBy: { id: "asc" } });
  const resultados = await Promise.all([0, 1].map(() => prisma.$transaction(tx => prepararProcessoEnvioTx(tx, d), { timeout: 20000 })));
  expect(resultados[0]).toEqual(resultados[1]);
  expect(await prisma.processoAssinaturaContratual.findUnique({ where: { id: base.processoId } })).toMatchObject({ estado: "CANCELADO", referenciaExterna: base.referenciaExternaFonte });
  expect(await prisma.processoAssinaturaContratual.findUnique({ where: { id: resultados[0].id }, include: { conclusao: true, tentativas: true } })).toMatchObject({ estado: "PREPARADO", artefatoId: base.artefatoSubstitutoId, referenciaExterna: null, tentativaAtual: 0, conclusao: null, tentativas: [] });
  expect(await prisma.aplicacaoSubstituicaoContratual.count()).toBe(1);
  expect(await prisma.processoAssinaturaContratual.count({ where: { estado: { not: "CANCELADO" } } })).toBe(1);
  expect(await prisma.cobranca.findMany({ orderBy: { id: "asc" } })).toEqual(cobrancas);
});

it("rollback após preparação desfaz aplicação, cancelamento local e novo processo juntos", async () => {
  const d = await confirmacaoParaAplicar();
  await expect(prisma.$transaction(async tx => { await prepararProcessoEnvioTx(tx, d); throw new Error("Falha antes do commit"); }, { timeout: 20000 })).rejects.toThrow("Falha antes do commit");
  expect(await prisma.aplicacaoSubstituicaoContratual.count()).toBe(0);
  expect(await prisma.processoAssinaturaContratual.count()).toBe(1);
  expect(await prisma.processoAssinaturaContratual.findUnique({ where: { id: base.processoId } })).toMatchObject({ estado: "ENVIADO" });
  expect(await prisma.observacaoCancelamentoAssinatura.count({ where: { resultado: "CONFIRMADO" } })).toBe(1);
});

it("banco impede cancelamento solto e aplicação sem criação do destino no commit", async () => {
  const d = await confirmacaoParaAplicar();
  await expect(prisma.processoAssinaturaContratual.update({ where: { id: base.processoId }, data: { estado: "CANCELADO" } })).rejects.toThrow(/aplicação de substituição ou desistência Q165 comprovada/);
  await expect(prisma.$transaction(tx => tx.aplicacaoSubstituicaoContratual.create({ data: { ...d.substituicao, processoSubstitutoId: "destino-nao-criado", executorId: base.secretariaId } }))).rejects.toThrow();
  expect(await prisma.aplicacaoSubstituicaoContratual.count()).toBe(0);
  await expect(prisma.$transaction(tx => prepararProcessoEnvioTx(tx, { ...d, artefatoId: base.artefatoFonteId }))).rejects.toThrow("não corresponde");
  const intencao = await prisma.intencaoCancelamentoAssinatura.findUniqueOrThrow({ where: { id: d.substituicao.intencaoId } });
  const incerta = await prisma.$transaction(tx => registrarObservacaoCancelamentoTx(tx, observacao(intencao.id, intencao.propostaId!, "INCERTO", "outro-retorno-incerto")));
  await expect(prisma.$transaction(tx => prepararProcessoEnvioTx(tx, { ...d, substituicao: { ...d.substituicao, observacaoId: incerta.id } }))).rejects.toThrow("ainda não foi confirmado");
});

it("assinatura depois da confirmação impede aplicar; evidências permanecem preservadas", async () => {
  const d = await confirmacaoParaAplicar(); await concluirFonte();
  await expect(prisma.$transaction(tx => prepararProcessoEnvioTx(tx, d))).rejects.toThrow("Q117");
  expect(await prisma.processoAssinaturaContratual.count()).toBe(1);
  expect(await prisma.observacaoCancelamentoAssinatura.count()).toBe(1);
});

it("conclusão tardia da fonte cancelada é preservada e bloqueia o envio do substituto", async () => {
  const d = await confirmacaoParaAplicar();
  const novo = await prisma.$transaction(tx => prepararProcessoEnvioTx(tx, d), { timeout: 20000 });
  const conclusao = await concluirFonte();
  expect(await prisma.conclusaoAssinaturaContratual.findUnique({ where: { id: conclusao.id } })).not.toBeNull();
  await expect(prisma.$transaction(tx => iniciarTentativaAssinaturaTx(tx, { processoId: novo.id, executorId: base.secretariaId }))).rejects.toThrow("Q117");
  await expect(prisma.processoAssinaturaContratual.update({ where: { id: novo.id }, data: { estado: "ENVIANDO" } })).rejects.toThrow("Q117");
  expect(await prisma.tentativaEnvioAssinatura.count({ where: { processoId: novo.id } })).toBe(0);
  expect(await prisma.processoAssinaturaContratual.findUnique({ where: { id: base.processoId } })).toMatchObject({ estado: "CANCELADO" });
});

it("preserva retorno do envio já iniciado quando a assinatura antiga chega durante a chamada", async () => {
  const d = await confirmacaoParaAplicar();
  const novo = await prisma.$transaction(tx => prepararProcessoEnvioTx(tx, d), { timeout: 20000 });
  const tentativa = await prisma.$transaction(tx => iniciarTentativaAssinaturaTx(tx, { processoId: novo.id, executorId: base.secretariaId }));
  await concluirFonte();
  const retorno = await prisma.$transaction(tx => registrarResultadoEnvioTx(tx, { processoId: novo.id, tentativaId: tentativa.tentativaId, chave: "retorno-apos-assinatura-fonte", resultado: "REGISTRADO", referenciaExterna: "substituto-enviado-simulado", evidenciaHash: "e".repeat(64) }));
  expect(retorno.estado).toBe("ENVIADO");
  expect(await prisma.observacaoEnvioAssinatura.count({ where: { tentativaId: tentativa.tentativaId } })).toBe(1);
  const [conflito] = await prisma.$queryRaw<{ existe: boolean }[]>`SELECT fonte_assinada_substituicao_218(${novo.id}) AS existe`;
  expect(conflito.existe).toBe(true);
  await expect(prisma.$transaction(tx => iniciarTentativaAssinaturaTx(tx, { processoId: novo.id, executorId: base.secretariaId }))).rejects.toThrow("Q117");
});

it("consulta acompanha os fatos da proposta até a aplicação e prioriza conflito tardio", async () => {
  const p = await preparar();
  const consultar = () => consultarPropostaSubstituicao({ matriculaId: base.matriculaId, propostaId: p.id });
  const etapa = async (valor: string) => expect(await consultar()).toMatchObject({ ok: true, dado: { andamento: { etapa: valor, ambiente: "SANDBOX" } } });
  await etapa("AGUARDANDO_APROVACAO");
  await decidir(p); await etapa("CANCELAMENTO_NAO_INICIADO");
  const i = await iniciar(p); await etapa("CANCELAMENTO_A_CONCILIAR");
  const o = await prisma.$transaction(tx => registrarObservacaoCancelamentoTx(tx, observacao(i.id, p.id, "CONFIRMADO")));
  await etapa("CONFIRMADO_AGUARDANDO_APLICACAO");
  await prisma.$transaction(tx => prepararProcessoEnvioTx(tx, { matriculaId: base.matriculaId, artefatoId: base.artefatoSubstitutoId, conferenciaId: base.conferenciaSubstitutoId, executorId: base.secretariaId, fornecedor: "ZAPSIGN", ambiente: "SANDBOX", substituicao: { intencaoId: i.id, observacaoId: o.id, propostaHash: p.propostaHash } }), { timeout: 20000 });
  await etapa("SUBSTITUTO_PREPARADO");
  expect(await consultar()).toMatchObject({ ok: true, dado: { andamento: { aplicacao: { artefatoSubstitutoId: base.artefatoSubstitutoId } } } });
  await concluirFonte(); await etapa("CONFLITO_ASSINATURA");
});

it("pagina retornos sem perder confirmação antiga ou expor identificadores do fornecedor", async () => {
  const p = await preparar(); await decidir(p); const i = await iniciar(p);
  await prisma.$transaction(tx => registrarObservacaoCancelamentoTx(tx, observacao(i.id, p.id, "CONFIRMADO", "confirmacao-mais-antiga")));
  for (let n = 0; n < 21; n++) await prisma.$transaction(tx => registrarObservacaoCancelamentoTx(tx, observacao(i.id, p.id, "INCERTO", `retorno-paginado-${n}`)));
  const consultar = (paginaObservacoes: number) => consultarPropostaSubstituicao({ matriculaId: base.matriculaId, propostaId: p.id, paginaObservacoes });
  const primeira = await consultar(1), segunda = await consultar(2);
  if (!primeira.ok || !primeira.dado || !segunda.ok || !segunda.dado) throw new Error("Histórico não disponível");
  const a = primeira.dado.andamento, b = segunda.dado.andamento;
  expect(a.observacoes).toHaveLength(20); expect(a.temProxima).toBe(true);
  expect(b.observacoes).toHaveLength(2); expect(b.temProxima).toBe(false);
  expect(a.observacoes.every(o => o.resultado === "INCERTO")).toBe(true);
  expect(b.observacoes.some(o => o.resultado === "CONFIRMADO")).toBe(true);
  expect(a).toMatchObject({ cancelamentoConfirmado: true, etapa: "CONFIRMADO_AGUARDANDO_APLICACAO" });
  expect(new Set([...a.observacoes, ...b.observacoes].map(o => o.id)).size).toBe(22);
  const serializado = JSON.stringify(a);
  for (const campo of ["referenciaExterna", "evidenciaHash", "chave", "intencaoId", "processoId", "propostaHash"]) expect(serializado).not.toContain(`"${campo}"`);
  expect(serializado).not.toContain(base.referenciaExternaFonte);
  expect(await consultar(0)).toMatchObject({ ok: false });
});
