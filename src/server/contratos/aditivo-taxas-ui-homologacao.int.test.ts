import { expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import { FormaPagamento, Papel, TipoCobranca } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { prepararFixtureSubstituicaoContratual } from "@/test/substituicao-contratual";
import { preservarConclusaoAssinaturaTx } from "./conclusao-assinatura-tx";
import { IdentidadeSignatarioSchema } from "./participantes-schema";
import { hashPrevia } from "./previa-estado";
import { prepararModeloTx } from "./modelos-tx";
import { decidirModeloContratual } from "./modelos";
import { prepararAditivoContratualTx, decidirAditivoContratualTx } from "./aditivo-tx";
import { decidirAlcadaAditivo } from "./aditivo-alcadas";
import { conferirParticipantesAditivoTx } from "./aditivo-participantes-tx";
import { preservarOriginalAditivo } from "./aditivo-originais";
import { consultarAssinaturaAditivo, registrarConferenciaAssinaturaAditivo } from "./aditivo-assinatura";
import { prepararProcessoAssinaturaAditivo } from "./aditivo-envio";
import { iniciarTentativaAditivoTx, registrarResultadoEnvioAditivoTx } from "./aditivo-envio-tx";
import { preservarConclusaoAssinaturaAditivoTx } from "./aditivo-conclusao-tx";
import { consultarConferenciaFinalAditivo, registrarConferenciaFinalAditivo } from "./aditivo-conferencia-final";
import { registrarCondicoesFormalizadasAditivo } from "./aditivo-condicoes";
import { receberTx } from "@/server/financeiro/recebimentos";

const arquivo = "node_modules/.implementation/q170-ui-homologacao-fixture.json";
const senha = "Homologacao-Q170-Local";
let base: Awaited<ReturnType<typeof prepararFixtureSubstituicaoContratual>>;
let alvo: { matriculaId: string; propostaId: string; conclusaoId: string; revisaoHash: string };
let cobrancaId: string;
type CoberturaAditivo = {
  inicioNovo: string;
  fimNovo: string;
  ciclo: { escolha: "PRESERVAR_REFERENCIA" } | { escolha: "MUDAR_REFERENCIA"; referencia: "MES_CIVIL" | "CICLO_MATRICULA"; dataReferencia?: string };
};
async function prepararCadeiaTaxa(vencimentoTaxa?: string, cobertura = false, coberturaAditivo?: CoberturaAditivo) {
 const coberturaFormalizada = coberturaAditivo ?? { inicioNovo: "2026-11-01", fimNovo: "2026-11-30", ciclo: { escolha: "PRESERVAR_REFERENCIA" as const } };
 base = await prepararFixtureSubstituicaoContratual(authMock, { camposFinanceiros: true, ambiente: "PRODUCAO", semSubstituicao: true });
 const fonte = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: base.processoId }, include: { artefato: { include: { conferencia: true } } } });
 const pessoas = z.object({ participantes: z.array(z.object({ identidade: IdentidadeSignatarioSchema })) }).parse(fonte.artefato.conferencia.snapshot).participantes;
 const envioFonte = await prisma.tentativaEnvioAssinatura.findFirstOrThrow({ where: { processoId: fonte.id }, orderBy: { numero: "desc" } }), agora = envioFonte.iniciadaEm.toISOString();
 const conclusao = await prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, { processoId: fonte.id, referenciaExterna: base.referenciaExternaFonte, originalHash: fonte.artefato.pdfHash, concluidaEm: agora, pdfAssinado: Buffer.from("%PDF-assinado"), evidencias: Buffer.from("evidencia"), assinaturas: [{ papel: "ALUNO", identidadeHash: hashPrevia(pessoas[0].identidade), referenciaAssinatura: "fonte", assinadaEm: agora }] }));
 const modelo = await prisma.$transaction(tx => prepararModeloTx(tx, base.secretariaId, { codigo: "DCT03", versaoEsperada: 0, chaveIdempotencia: "dct03-modelo", motivo: "Modelo de acerto de taxa", conteudo: { titulo: "Aditivo", finalidade: "ADITIVO", regimes: ["MENSALIDADE"], aplicacao: "Teste DCT03", campos: [{ chave: "nome", descricao: "Aluno", origem: "ALUNO_NOME" }, { chave: "taxa", descricao: "Taxa", origem: "TAXA_VALOR" }, { chave: "vencimento", descricao: "Vencimento da taxa", origem: "TAXA_VENCIMENTO" }, ...(cobertura ? [{ chave: "inicio", descricao: "Início da cobertura", origem: "COBERTURA_INICIO" as const }, { chave: "fim", descricao: "Fim da cobertura", origem: "COBERTURA_FIM" as const }] : []), { chave: "original", descricao: "Original", origem: "ADITIVO_CONTRATO_ORIGINAL" }, { chave: "anteriores", descricao: "Anteriores", origem: "ADITIVO_ANTERIORES" }, { chave: "alteracoes", descricao: "Alterações", origem: "ADITIVO_ALTERACOES" }, { chave: "vigencia", descricao: "Vigência", origem: "ADITIVO_VIGENCIA" }], secoes: [{ titulo: "Dados", texto: "{{nome}} {{taxa}} {{vencimento}} {{original}} {{anteriores}} {{alteracoes}} {{vigencia}}" }], assinaturas: [{ papel: "ALUNO", condicao: "SEMPRE" }] } }));
 const modeloGravado = await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: modelo.id } }); authMock.mockResolvedValue({ user: { id: base.adminId } }); await decidirModeloContratual({ modeloId: modelo.id, conteudoHash: modeloGravado.conteudoHash, aprovada: true, motivo: "Modelo aprovado independentemente" }); authMock.mockResolvedValue({ user: { id: base.secretariaId } });
 const fonteAssinada = await prisma.conclusaoAssinaturaContratual.findUniqueOrThrow({ where: { id: conclusao.id } });
 const proposta = await prisma.$transaction(tx => prepararAditivoContratualTx(tx, base.secretariaId, { matriculaId: base.matriculaId, conclusaoOriginalId: conclusao.id, conclusaoHashEsperado: fonteAssinada.entradaHash, modeloId: modelo.id, modeloHashEsperado: modeloGravado.conteudoHash, vigenciaInicio: "2026-09-01T00:00:00-03:00", alteracoes: cobertura ? [{ origem: "COBERTURA_INICIO", novo: coberturaFormalizada.inicioNovo, valorEstruturado: { tipo: "DATA", data: coberturaFormalizada.inicioNovo } }, { origem: "COBERTURA_FIM", novo: coberturaFormalizada.fimNovo, valorEstruturado: { tipo: "DATA", data: coberturaFormalizada.fimNovo } }] : [{ origem: "TAXA_VALOR", novo: "80.00 CRC", valorEstruturado: { tipo: "DINHEIRO", valor: "80", moeda: "CRC" } }, ...(vencimentoTaxa ? [{ origem: "TAXA_VENCIMENTO" as const, novo: vencimentoTaxa, valorEstruturado: { tipo: "DATA" as const, data: vencimentoTaxa } }] : [])], ...(cobertura ? { cicloCoberturaFutura: coberturaFormalizada.ciclo } : {}), motivo: cobertura ? "Corrigir cobertura formalizada para o acerto" : "Reduzir taxa paga para acerto", chaveIdempotencia: "dct03-proposta" }));
 await prisma.$transaction(tx => decidirAditivoContratualTx(tx, base.adminId, { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, aprovada: true, motivo: "Aditivo aprovado independentemente" }));
 authMock.mockResolvedValue({ user: { id: base.adminId } }); for (const alcada of ["FINANCEIRA", "COMERCIAL"] as const) await decidirAlcadaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, propostaHash: proposta.propostaHash, alcada, aprovada: true, motivo: "Alçada aprovada independentemente" });
 authMock.mockResolvedValue({ user: { id: base.secretariaId } }); const aluno = await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId }, include: { aluno: true } }), identidade = { nome: `${aluno.aluno.primeiroNome} ${aluno.aluno.sobrenome}`, email: aluno.aluno.email!, documento: aluno.aluno.documento! };
 const participantes = await prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, base.secretariaId, { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, versaoEsperada: 0, maioridade: null, participantes: [{ papel: "ALUNO", identidade }], identificacoesConferidas: true, motivo: "Participantes conferidos para o aditivo", chaveIdempotencia: "dct03-participantes" }));
 const original = await preservarOriginalAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conferenciaId: participantes.id, conferenciaHash: participantes.revisaoHash, conteudoConferido: true, motivo: "Original conferido para assinatura" }); if (!original.ok || !original.dado) throw new Error(JSON.stringify(original));
 const assinatura = await consultarAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: original.dado.id }); if (!assinatura.ok || !assinatura.dado?.revisao) throw new Error(JSON.stringify(assinatura));
 const conferencia = await registrarConferenciaAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: original.dado.id, revisaoHash: assinatura.dado.revisao.hash, dadosConferidos: true, motivo: "Assinatura conferida para o aditivo", chaveIdempotencia: "dct03-assinatura" }); if (!conferencia.ok || !conferencia.dado) throw new Error(JSON.stringify(conferencia));
 const processo = await prepararProcessoAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: original.dado.id, conferenciaId: conferencia.dado.id, fornecedor: "ZAPSIGN", ambiente: "PRODUCAO" }); if (!processo.ok || !processo.dado) throw new Error(JSON.stringify(processo));
 const tentativa = await prisma.$transaction(tx => iniciarTentativaAditivoTx(tx, base.secretariaId, { processoId: processo.dado!.id })); await prisma.$transaction(tx => registrarResultadoEnvioAditivoTx(tx, { processoId: processo.dado!.id, tentativaId: tentativa.tentativaId, chave: "dct03-envio", resultado: "REGISTRADO", referenciaExterna: "dct03-assinado", evidenciaHash: "a".repeat(64) }));
 const artefato = await prisma.artefatoAditivoContratual.findUniqueOrThrow({ where: { id: original.dado.id }, include: { conferencia: true } }), ass = z.object({ participantes: z.array(z.object({ papel: z.literal("ALUNO"), identidade: IdentidadeSignatarioSchema })) }).parse(artefato.conferencia.snapshot).participantes;
 const envioAditivo = await prisma.tentativaEnvioAditivo.findFirstOrThrow({ where: { processoId: processo.dado!.id }, orderBy: { numero: "desc" } }), agoraFim = envioAditivo.iniciadaEm.toISOString(), fim = await prisma.$transaction(tx => preservarConclusaoAssinaturaAditivoTx(tx, { processoId: processo.dado!.id, referenciaExterna: "dct03-assinado", originalHash: artefato.pdfHash, concluidaEm: agoraFim, pdfAssinado: Buffer.from("%PDF-assinado-aditivo"), evidencias: Buffer.from("evidencia-aditivo"), assinaturas: ass.map(x => ({ papel: x.papel, identidadeHash: hashPrevia(x.identidade), referenciaAssinatura: "dct03", assinadaEm: agoraFim })) }));
 const revisao = await consultarConferenciaFinalAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id }); if (!revisao.ok || !revisao.dado?.revisao) throw new Error(JSON.stringify(revisao)); const final = await registrarConferenciaFinalAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id, revisaoHash: revisao.dado.revisao.hash, documentoConferido: true, evidenciasConferidas: true, motivo: "Conclusão conferida para o acerto" }); if (!final.ok) throw new Error(JSON.stringify(final));
 const cond = await registrarCondicoesFormalizadasAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id, revisaoHash: revisao.dado.revisao.hash }); if (!cond.ok) throw new Error(JSON.stringify(cond)); alvo = { matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id, revisaoHash: revisao.dado.revisao.hash }; cobrancaId = (await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId, tipo: "MATRICULA" } })).id;
}

/**
 * Opt-in, no banco descartável: a cadeia usa stubs locais de assinatura.
 * Ela não chama provedor nem confirma assinatura de produção.
 */
it.runIf(process.env.HOMOLOGACAO_UI_Q170 === "true")("prepara fixture local para homologação operacional Q170", async () => {
  await truncarBanco();
  await prepararCadeiaTaxa();

  const [preparador, aprovador] = await Promise.all([
    criarUsuario([Papel.FINANCEIRO], "Financeiro preparador UI Q170"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro aprovador UI Q170"),
  ]);
  await prisma.usuario.update({
    where: { id: aprovador.id },
    data: { permissoes: ["financeiro.aprovar_acertos"] },
  });
  await prisma.cobranca.update({
    where: { id: cobrancaId },
    data: { valorOriginal: 100, valorNegociado: 100, saldo: 100 },
  });
  await prisma.$transaction(tx => receberTx(tx, {
    cobrancaId,
    chaveIdempotencia: "fixture-q170-pagamento-original",
    autorId: preparador.id,
    valorRecebido: 100,
    forma: FormaPagamento.TRANSFERENCIA,
    dataPagamento: new Date("2026-09-01T12:00:00.000Z"),
    evidencia: "Pagamento fictício local da taxa original para homologação Q170.",
  }));
  const original = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  const preservada = await prisma.cobranca.create({
    data: {
      matriculaId: base.matriculaId,
      tipo: TipoCobranca.MATRICULA,
      moeda: original.moeda,
      valorOriginal: 35,
      valorNegociado: 35,
      saldo: 35,
      vencimento: new Date("2026-09-15T12:00:00.000Z"),
    },
  });

  const usuarios = [
    [base.secretariaId, "secretaria-ui170@genius.test"],
    [base.adminId, "admin-ui170@genius.test"],
    [preparador.id, "financeiro-preparador-ui170@genius.test"],
    [aprovador.id, "financeiro-aprovador-ui170@genius.test"],
  ] as const;
  const senhaHash = await bcrypt.hash(senha, 10);
  await Promise.all(usuarios.map(([id, email]) => prisma.usuario.update({
    where: { id }, data: { email, senhaHash, ativo: true },
  })));

  const fixture = {
    matriculaId: base.matriculaId,
    propostaId: alvo.propostaId,
    conclusaoId: alvo.conclusaoId,
    taxaAfetadaId: cobrancaId,
    taxaPreservadaId: preservada.id,
    moeda: original.moeda,
    rotas: {
      lista: "/financeiro/acertos-taxa",
      detalhe: "/financeiro/acertos-taxa/" + base.matriculaId + "/" + alvo.propostaId,
    },
    senha,
    usuarios: Object.fromEntries(usuarios.map(([, email]) => [email.split("@")[0].replace("-ui170", ""), email])),
    assinatura: "SIMULADA_LOCAL: nenhuma confirmação ou transporte a fornecedor foi realizado.",
  };
  await fs.mkdir("node_modules/.implementation", { recursive: true });
  await fs.writeFile(arquivo, JSON.stringify(fixture, null, 2) + "\n");

  expect(original.valorRecebido?.toFixed(2)).toBe("100.00");
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: preservada.id } })).valorRecebido).toBeNull();
  expect(await prisma.cobranca.count({ where: { matriculaId: base.matriculaId, tipo: TipoCobranca.MATRICULA } })).toBe(2);
  console.log(JSON.stringify({ fixture: arquivo, ...fixture }));
});
