import type { DegrauConfig, NumeroConfig, PoliticaConfig } from "@/server/whatsapp/consultas";

// Alteração pendente nas telas de configuração do WhatsApp (C32 da #170; docs/42 L2519): números, setores,
// política da régua e avisos de agenda. A base é o que veio do servidor (as props do painel): depois de
// salvar, o router.refresh traz o valor novo e o formulário volta a coincidir com ele, sem estado extra.
// O painel usa o resultado para o aviso ao sair (useAvisoAoSair) e para a marca "Alterações não salvas".

/** Os campos do formulário de número (os mesmos do FormNumero do NumerosPainel). */
export interface CamposNumero {
  id?: string;
  telefoneE164: string;
  rotulo: string;
  finalidade: string;
  donoId: string;
  ativo: boolean;
}

const NUMERO_VAZIO: CamposNumero = { telefoneE164: "", rotulo: "", finalidade: "COBRANCA", donoId: "", ativo: true };

/** O formulário de número aberto difere do número salvo (ou do vazio, num número novo)? */
export function numeroAlterado(form: CamposNumero | null, numeros: readonly NumeroConfig[]): boolean {
  if (!form) return false;
  const salvo = form.id ? numeros.find((n) => n.id === form.id) : null;
  if (form.id && !salvo) return true; // outra pessoa apagou: o que está na tela não está salvo em lugar nenhum
  const origem: CamposNumero = salvo
    ? { telefoneE164: salvo.telefoneE164, rotulo: salvo.rotulo, finalidade: salvo.finalidade, donoId: salvo.donoId ?? "", ativo: salvo.ativo }
    : NUMERO_VAZIO;
  return form.telefoneE164 !== origem.telefoneE164 || form.rotulo !== origem.rotulo || form.finalidade !== origem.finalidade
    || form.donoId !== origem.donoId || form.ativo !== origem.ativo;
}

const mesmoConjunto = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Setores (sem ordem) e triagem que seriam gravados diferem do número salvo? `triagem` vazia = nenhuma. */
export function setoresAlterados(
  setores: readonly string[],
  triagem: string,
  numero: Pick<NumeroConfig, "setores" | "triagemResponsavelId">,
): boolean {
  return !mesmoConjunto(setores, numero.setores) || triagem !== (numero.triagemResponsavelId ?? "");
}

/** Número e template escolhidos diferem da configuração salva (null salvo = vazio na tela)? */
export function avisosAgendaAlterados(
  numeroId: string,
  templateId: string,
  config: { numeroAvisosAgendaId: string | null; templateAvisosAgendaId: string | null },
): boolean {
  return numeroId !== (config.numeroAvisosAgendaId ?? "") || templateId !== (config.templateAvisosAgendaId ?? "");
}

/** Os campos do formulário da política (os mesmos do estado do PoliticaPainel). */
export interface CamposPolitica {
  estado: string;
  janelaInicio: number;
  janelaFim: number;
  diasSemana: number[];
  tetoPorContatoDia: number;
  silencioPosInboundHoras: number;
  killSwitch: boolean;
  numeroRemetenteId: string;
  degraus: DegrauConfig[];
}

const degrauGravado = (d: DegrauConfig) => [d.passo, d.offsetDias, d.modo, d.ativo, d.templateId ?? null];

/**
 * A política na tela difere da salva? O kill switch fica de fora: ele grava na hora, pela confirmação
 * própria, e não depende do "Salvar política". A ordem dos dias marcados não conta.
 */
export function politicaAlterada(form: CamposPolitica, politica: PoliticaConfig): boolean {
  return form.estado !== politica.estado
    || form.janelaInicio !== politica.janelaInicio
    || form.janelaFim !== politica.janelaFim
    || !mesmoConjunto(form.diasSemana.map(String), politica.diasSemana.map(String))
    || form.tetoPorContatoDia !== politica.tetoPorContatoDia
    || form.silencioPosInboundHoras !== politica.silencioPosInboundHoras
    || form.numeroRemetenteId !== (politica.numeroRemetenteId ?? "")
    || JSON.stringify(form.degraus.map(degrauGravado)) !== JSON.stringify(politica.degraus.map(degrauGravado));
}
