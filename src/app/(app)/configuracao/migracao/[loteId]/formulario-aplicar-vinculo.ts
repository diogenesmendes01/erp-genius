export type TipoFatoMigrado = "ATIVACAO" | "PAUSA" | "ENCERRAMENTO" | "CANCELAMENTO";
export type SemanticaFimMigrada = "LIMITE_EXCLUSIVO" | "ULTIMO_DIA_COBERTO";

export type EnsaioVinculoExibido = {
  id: string;
  entradaHash: string;
  contextoHash: string;
  resultado: string;
  vigente: boolean;
  criadoEm: Date;
  ensaiadoPor: { nome: string };
};

export type FatoFormularioVinculo = { tipo: TipoFatoMigrado; data: string; evidencia: string };
export type FormularioVinculo = {
  fusoReferencia: string;
  inicioAlocacao: string;
  fimAlocacao: string;
  semanticaFim: "" | SemanticaFimMigrada;
  diaVencimento: string;
  mesesPlano: string;
  evidenciaContrato: string;
  evidenciaPagamento: string;
  motivoComplemento: string;
  evidenciaComplemento: string;
  fatos: FatoFormularioVinculo[];
};

export type PayloadAplicarVinculo = {
  linhaId: string;
  ensaioId: string;
  entradaHash: string;
  contextoHash: string;
  fusoReferencia: string;
  semanticaFim: SemanticaFimMigrada;
  inicioAlocacao: string;
  fimAlocacao: string | null;
  diaVencimento: number;
  mesesPlano: number;
  evidenciaContrato: { referencia: string };
  evidenciaPagamento: { referencia: string };
  complementoVigencia?: { motivo: string; evidencia: { referencia: string } };
  fatos: Array<{ tipo: TipoFatoMigrado; data: string; evidencia: { referencia: string } }>;
};

const dataCivil = /^\d{4}-\d{2}-\d{2}$/;
const dataCivilValida = (valor: string) => {
  if (!dataCivil.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
};
const tipoFinalPorSituacao: Record<string, TipoFatoMigrado> = {
  ATIVA: "ATIVACAO", PAUSADA: "PAUSA", ENCERRADA: "ENCERRAMENTO", CANCELADA: "CANCELAMENTO",
};

/** Só o ensaio mais recente que ainda representa as correspondências atuais pode ser aplicado. */
export function ensaioVigenteMaisRecente(ensaios: EnsaioVinculoExibido[], entradaHash: string) {
  const maisRecente = ensaios[0];
  return maisRecente && maisRecente.entradaHash === entradaHash && maisRecente.vigente && maisRecente.resultado === "PRONTO_PARA_REVISAO"
    ? maisRecente
    : null;
}

function limitesDaFonte(dadosOrigem: unknown) {
  const alocacao = dadosOrigem && typeof dadosOrigem === "object" ? (dadosOrigem as { alocacao?: unknown }).alocacao : null;
  const valores = alocacao && typeof alocacao === "object" ? alocacao as { inicio?: unknown; fim?: unknown } : null;
  return {
    inicio: typeof valores?.inicio === "string" ? valores.inicio.trim() : null,
    fim: typeof valores?.fim === "string" ? valores.fim.trim() : null,
  };
}

export function exigeComplementoVigencia(dadosOrigem: unknown, inicio: string, fim: string) {
  const fonte = limitesDaFonte(dadosOrigem);
  return fonte.inicio !== inicio || fonte.fim !== (fim || null);
}

export function validarFormularioVinculo(formulario: FormularioVinculo, dadosOrigem: unknown, statusDestino: string | null) {
  const erros: string[] = [];
  const fuso = formulario.fusoReferencia.trim();
  if (!fuso) erros.push("Informe o fuso IANA de referência.");
  else if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)*$/.test(fuso) || (() => { try { new Intl.DateTimeFormat("en", { timeZone: fuso }).format(); return false; } catch { return true; } })()) erros.push("Informe um fuso IANA válido.");
  if (!dataCivilValida(formulario.inicioAlocacao)) erros.push("Informe o início da vigência.");
  if (formulario.fimAlocacao && !dataCivilValida(formulario.fimAlocacao)) erros.push("Informe um fim de vigência válido.");
  if (!formulario.semanticaFim) erros.push("Escolha a semântica do fim da vigência.");
  if (dataCivilValida(formulario.inicioAlocacao) && formulario.fimAlocacao && dataCivilValida(formulario.fimAlocacao)) {
    if (formulario.semanticaFim === "LIMITE_EXCLUSIVO" && formulario.fimAlocacao <= formulario.inicioAlocacao) erros.push("O limite exclusivo precisa ser posterior ao início.");
    if (formulario.semanticaFim === "ULTIMO_DIA_COBERTO" && formulario.fimAlocacao < formulario.inicioAlocacao) erros.push("O último dia coberto não pode ser anterior ao início.");
  }
  const dia = Number(formulario.diaVencimento);
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) erros.push("Informe o dia de vencimento entre 1 e 31.");
  const meses = Number(formulario.mesesPlano);
  if (!Number.isInteger(meses) || meses < 1) erros.push("Informe a quantidade de meses do plano.");
  if (!formulario.evidenciaContrato.trim()) erros.push("Informe a evidência do contrato.");
  if (!formulario.evidenciaPagamento.trim()) erros.push("Informe a evidência do pagamento.");
  if (!formulario.fatos.length) erros.push("Informe ao menos um fato histórico.");
  formulario.fatos.forEach((fato, indice) => {
    if (!dataCivilValida(fato.data)) erros.push(`Informe a data do fato ${indice + 1}.`);
    if (!fato.evidencia.trim()) erros.push(`Informe a evidência do fato ${indice + 1}.`);
  });
  const tipoFinal = statusDestino ? tipoFinalPorSituacao[statusDestino] : undefined;
  if (tipoFinal && formulario.fatos.at(-1)?.tipo !== tipoFinal) erros.push("O último fato precisa comprovar a situação de destino.");
  if (["ENCERRADA", "CANCELADA"].includes(statusDestino ?? "") && !formulario.fimAlocacao) erros.push("A situação encerrada exige fim de vigência comprovado.");
  const temParteDoComplemento = !!formulario.motivoComplemento.trim() || !!formulario.evidenciaComplemento.trim();
  if (temParteDoComplemento && (!formulario.motivoComplemento.trim() || !formulario.evidenciaComplemento.trim())) erros.push("Informe motivo e evidência do complemento de vigência juntos.");
  if (exigeComplementoVigencia(dadosOrigem, formulario.inicioAlocacao, formulario.fimAlocacao) && !formulario.motivoComplemento.trim()) erros.push("A vigência difere da fotografia; informe motivo e evidência do complemento.");
  if (formulario.motivoComplemento.trim() && formulario.motivoComplemento.trim().length < 10) erros.push("O motivo do complemento precisa ter pelo menos 10 caracteres.");
  return erros;
}

export function montarPayloadAplicarVinculo(args: {
  linhaId: string;
  entradaHash: string;
  ensaio: EnsaioVinculoExibido;
  formulario: FormularioVinculo;
}): PayloadAplicarVinculo {
  const { linhaId, entradaHash, ensaio, formulario } = args;
  if (!formulario.semanticaFim) throw new Error("Semântica de fim ausente.");
  const complemento = formulario.motivoComplemento.trim() && formulario.evidenciaComplemento.trim()
    ? { complementoVigencia: { motivo: formulario.motivoComplemento.trim(), evidencia: { referencia: formulario.evidenciaComplemento.trim() } } }
    : {};
  return {
    linhaId, ensaioId: ensaio.id, entradaHash, contextoHash: ensaio.contextoHash,
    fusoReferencia: formulario.fusoReferencia.trim(), semanticaFim: formulario.semanticaFim,
    inicioAlocacao: formulario.inicioAlocacao, fimAlocacao: formulario.fimAlocacao || null,
    diaVencimento: Number(formulario.diaVencimento), mesesPlano: Number(formulario.mesesPlano),
    evidenciaContrato: { referencia: formulario.evidenciaContrato.trim() },
    evidenciaPagamento: { referencia: formulario.evidenciaPagamento.trim() },
    ...complemento,
    fatos: formulario.fatos.map((fato) => ({ tipo: fato.tipo, data: fato.data, evidencia: { referencia: fato.evidencia.trim() } })),
  };
}
