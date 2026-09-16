import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { PrepararAditivoContratualSchema } from "./aditivo-schema";
import { preencherTextoAditivo } from "./aditivo-texto";
import { OrigemCampo, ROTULOS_ORIGEM } from "./campos";
import { ConteudoModeloSchema } from "./modelo-schema";
import { TextoPreviaSchema } from "./previa-projecao";
import { ConclusaoAssinaturaSchema, validarConclusaoAssinatura } from "./conclusao-assinatura-schema";
import { hashSubstituicao } from "./substituicao-estado";
import { extrairOrigemEstruturadaAditivo } from "./aditivo-origem-estruturada";
import { validarCoerenciaValoresAditivo } from "./aditivo-coerencia";
import { carregarCadeiaAditivoTx } from "./aditivo-cadeia";
import { representarValorAlteracaoAditivo } from "./aditivo-valores";

/** Base própria de aditivo: consulta o documento preservado, não regenera o
 * contrato assinado com o cadastro atual. Chamador confere a sessão primeiro. */
export async function carregarBaseAditivoTx(tx: Prisma.TransactionClient, entrada: unknown, antesDaVersao?: number) {
  const d = PrepararAditivoContratualSchema.parse(entrada);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [d.matriculaId]);
  const c = await tx.conclusaoAssinaturaContratual.findFirst({ where: { id: d.conclusaoOriginalId, processo: { matriculaId: d.matriculaId } }, include: {
    processo: { include: { artefato: { include: { previa: true, conferencia: true } }, tentativas: { orderBy: { numero: "desc" }, take: 1 } } },
  } });
  if (!c) throw new ErroRegra("Conclusão contratual indisponível nesta matrícula.");
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaContratual" WHERE id = ${c.processoId} FOR UPDATE`;
  const p = c.processo, a = p.artefato, envio = p.tentativas[0];
  if (p.estado !== "ENVIADO" || !envio || p.referenciaExterna !== c.referenciaExterna || c.originalHash !== a.pdfHash
    || createHash("sha256").update(a.pdf).digest("hex") !== a.pdfHash || c.entradaHash !== d.conclusaoHashEsperado) throw new ErroRegra("Confira a fonte assinada e sua integridade antes de propor o aditivo.");
  const validada = validarConclusaoAssinatura({ processoId: p.id, referenciaExterna: c.referenciaExterna, originalHash: c.originalHash,
    concluidaEm: c.concluidaEm.toISOString(), pdfAssinado: c.pdfAssinado, evidencias: c.evidencias,
    assinaturas: ConclusaoAssinaturaSchema.shape.assinaturas.element.strip().array().parse(c.assinaturas) }, a.conferencia.snapshot, envio.iniciadaEm);
  if (validada.entradaHash !== c.entradaHash || validada.pdfHash !== c.pdfHash || validada.evidenciasHash !== c.evidenciasHash) throw new ErroRegra("As evidências divergem da conclusão preservada.");
  const outras = await tx.conclusaoAssinaturaContratual.count({ where: { id: { not: c.id }, processo: { matriculaId: d.matriculaId } } });
  if (outras) throw new ErroRegra("Há mais de um original assinado nesta matrícula. Resolva a fonte contratual antes de propor condições.");
  const modelo = await tx.versaoModeloContratual.findUnique({ where: { id: d.modeloId }, include: { decisao: true } });
  if (!modelo?.decisao?.aprovada || modelo.conteudoHash !== d.modeloHashEsperado) throw new ErroRegra("Confira a versão publicada do modelo de aditivo.");
  const conteudo = ConteudoModeloSchema.parse(modelo.conteudo);
  const original = TextoPreviaSchema.parse(a.previa.snapshot);
  const cadeia = await carregarCadeiaAditivoTx(tx, { matriculaId: d.matriculaId, antesDaVersao });
  const regimeOriginal = z.object({ condicoes: z.object({ aulas: z.object({ regime: z.enum(["MENSALIDADE", "HORA_PARTICULAR"]) }) }) }).parse(a.previa.snapshot).condicoes.aulas.regime;
  const regime = cadeia.condicoes.REGIME?.tipo === "REGIME" ? cadeia.condicoes.REGIME.regime : regimeOriginal;
  if (!conteudo.regimes.includes(regime)) throw new ErroRegra("Modelo incompatível com o regime contratado.");
  const fontes: Partial<Record<OrigemCampo, string>> = {};
  for (const campo of original.documento.campos) {
    if (fontes[campo.origem] !== undefined && fontes[campo.origem] !== campo.valor) throw new ErroRegra("O original possui valores divergentes para a mesma condição.");
    fontes[campo.origem] = campo.valor;
  }
  for (const [origem, valor] of Object.entries(cadeia.condicoes)) fontes[origem as OrigemCampo] = representarValorAlteracaoAditivo(valor);
  const alteracoes = d.alteracoes.map(mudanca => {
    const anterior = fontes[mudanca.origem];
    if (!anterior) throw new ErroRegra(`A condição ${ROTULOS_ORIGEM[mudanca.origem]} não está estruturada no original preservado. Confira sua origem antes de propor a alteração.`);
    return { campo: mudanca.origem, rotulo: ROTULOS_ORIGEM[mudanca.origem], anterior, novo: mudanca.novo };
  });
  // Valores novos são comparados às condições imutáveis do original assinado.
  // Legados não são interpretados a partir do texto nem ganham dados presumidos.
  if (d.alteracoes.some(m => m.valorEstruturado && (m.valorEstruturado.tipo === "DINHEIRO" || m.origem === "MOEDA" || m.origem === "COBERTURA_INICIO" || m.origem === "COBERTURA_FIM"))) {
    const relacionadas = new Set(["MOEDA", "TAXA_VALOR", "MENSALIDADE_VALOR", "HORA_VALOR", "ADIANTAMENTO_VALOR", "COBERTURA_INICIO", "COBERTURA_FIM"]);
    if (d.alteracoes.some(m => relacionadas.has(m.origem) && !m.valorEstruturado)) throw new ErroRegra("Preencha os valores estruturados de todas as condições financeiras alteradas nesta proposta.");
    try {
      const origemAtual = extrairOrigemEstruturadaAditivo(a.previa.snapshot);
      if (cadeia.condicoes.MOEDA?.tipo === "MOEDA") origemAtual.moeda = cadeia.condicoes.MOEDA.moeda;
      if (cadeia.condicoes.COBERTURA_INICIO?.tipo === "DATA") origemAtual.coberturaInicio = cadeia.condicoes.COBERTURA_INICIO.data;
      if (cadeia.condicoes.COBERTURA_FIM?.tipo === "DATA") origemAtual.coberturaFim = cadeia.condicoes.COBERTURA_FIM.data;
      for (const [origem, valor] of Object.entries(cadeia.condicoes)) if (valor.tipo === "DINHEIRO" && !origemAtual.fontesMonetarias.includes(origem as OrigemCampo)) origemAtual.fontesMonetarias.push(origem as OrigemCampo);
      validarCoerenciaValoresAditivo({ origem: origemAtual,
        alteracoes: d.alteracoes.filter(m => m.valorEstruturado).map(m => ({ origem: m.origem, valorEstruturado: m.valorEstruturado })) });
    } catch (erro) { throw new ErroRegra(erro instanceof Error ? erro.message : "Confira a coerência das condições propostas."); }
  }
  const vigenciaInicio = new Date(d.vigenciaInicio).toISOString();
  if (cadeia.ultimaVigencia && new Date(vigenciaInicio) <= cadeia.ultimaVigencia) throw new ErroRegra("A vigência precisa suceder os aditivos formalizados anteriores.");
  const documento = preencherTextoAditivo(modelo.conteudo, {
    contratoOriginal: { documentoId: a.id, pdfHash: a.pdfHash }, aditivosAnteriores: cadeia.referencias, vigenciaInicio, alteracoes,
  }, fontes);
  const condicoes = await tx.condicoesEntradaPreparacao.findFirst({ where: { matriculaId: d.matriculaId }, orderBy: { versao: "desc" }, select: { id: true, versao: true } });
  const pagador = await tx.pagadorPreparacaoMatricula.findFirst({ where: { matriculaId: d.matriculaId }, orderBy: { versao: "desc" }, select: { id: true, versao: true } });
  const base = { tipo: "ORIGINAL", matriculaId: d.matriculaId, conclusaoOriginalId: c.id, conclusaoHash: c.entradaHash,
    artefatoOriginalId: a.id, originalHash: a.pdfHash, pdfAssinadoHash: c.pdfHash, ambiente: p.ambiente, referenciaExterna: p.referenciaExterna,
    modeloId: modelo.id, modeloHash: modelo.conteudoHash, publicacaoId: modelo.decisao.id,
    modeloCodigo: modelo.codigo, modeloVersao: modelo.versao, condicoes, pagador, aditivosAnterioresIds: cadeia.ids, fontes };
  return { matriculaId: d.matriculaId, conclusaoOriginalId: c.id, modeloId: modelo.id, vigenciaInicio,
    base, baseHash: hashSubstituicao(base), alteracoes, alteracoesHash: hashSubstituicao(alteracoes), documento };
}
