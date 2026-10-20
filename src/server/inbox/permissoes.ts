import { Papel } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { ehGerenteDoSetor, setoresVisiveisNoInbox, type Setor } from "@/server/whatsapp/setor";

/** Funções do Inbox sujeitas a alçada (doc 03; plano 03-fase-inbox, Tarefa 14). */
export type AcaoInbox = "enviar" | "editarApagar" | "encaminhar" | "preferenciaPessoal" | "assumir" | "devolver" | "atribuir" | "transferir" | "convidar" | "encerrar" | "notaInterna" | "agendar" | "grupoGerir" | "bloquear" | "perfilNumero" | "desvincular";

export interface ContextoAcao { setor: Setor; responsavelId: string | null; autorMensagemId?: string | null; participante?: boolean;
  /** Atendimento COMERCIAL de linha de vendas (número VENDAS) e o dono atual da linha: quem assume precisa continuar enxergando o atendimento (LC-D02). */
  linhaComercial?: boolean; donoLinhaId?: string | null }

/** Vínculo do contato com um cadastro (ContatoWhatsApp.alunoId/responsavelId/leadId). */
export type TipoVinculoContato = "aluno" | "responsavel" | "lead";

/**
 * D8 (#175, L2298): quais vínculos do contato cada setor desfaz pela tela, os mesmos que o setor faz em
 * `vincularContatoWhatsApp`. O pedagógico não expõe o contato e não vincula nem desvincula.
 */
export const TIPOS_DESVINCULAVEIS: Readonly<Record<Setor, readonly TipoVinculoContato[]>> = {
  COMERCIAL: ["lead"],
  SECRETARIA: ["aluno", "responsavel"],
  FINANCEIRO: ["aluno", "responsavel"],
  PEDAGOGICO: [],
};

const GERENTES: Papel[] = [Papel.GERENTE_COMERCIAL, Papel.GERENTE_PEDAGOGICO];

/** Papéis que encerram por setor: cópia de `encerrarAtendimentoWhatsApp` (operacoes-atendimento.ts). */
const ENCERRAM: Record<Setor, Papel[]> = {
  COMERCIAL: [Papel.GERENTE_COMERCIAL],
  FINANCEIRO: [Papel.FINANCEIRO],
  SECRETARIA: [Papel.SECRETARIA_ACADEMICA],
  PEDAGOGICO: [Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA],
};

/**
 * Alçada da ação. Não substitui o escopo: as actions continuam exigindo `atendimentoVisivel`
 * antes de chamar. Alçadas que o doc 03 não define (assumir, devolver, atribuir, transferir,
 * convidar) são propostas da Tarefa 14, a confirmar com o produto (Pendência 8).
 */
export function podeExecutar(u: Pick<UsuarioSessao, "id" | "papeis">, acao: AcaoInbox, ctx: ContextoAcao): boolean {
  const admin = u.papeis.includes(Papel.ADMINISTRADOR);
  const gerente = admin || u.papeis.some((p) => GERENTES.includes(p));
  const gerenteDoSetor = ehGerenteDoSetor(u.papeis, ctx.setor);
  const doResponsavel = ctx.responsavelId !== null && ctx.responsavelId === u.id;
  switch (acao) {
    case "enviar": case "encaminhar": case "preferenciaPessoal": case "notaInterna": case "agendar":
      return true;
    case "editarApagar":
      return !!ctx.autorMensagemId && ctx.autorMensagemId === u.id;
    case "assumir":
      // Só da fila; o professor não atende fila (Tarefa 13).
      // Em linha de vendas o responsável gravado não dá acesso (escopo.ts): só admin, gerente comercial ou o dono da linha
      // continuam enxergando o atendimento depois de assumir (mesmo critério de exigirResponsavelEnxerga).
      return ctx.responsavelId === null && setoresVisiveisNoInbox(u.papeis).includes(ctx.setor)
        && (admin || u.papeis.some((p) => p !== Papel.PROFESSOR))
        && (!ctx.linhaComercial || admin || gerenteDoSetor || (ctx.donoLinhaId != null && ctx.donoLinhaId === u.id));
    case "devolver": case "transferir": case "convidar":
      return doResponsavel || gerenteDoSetor;
    case "atribuir":
      return gerenteDoSetor;
    case "encerrar":
      return admin || u.papeis.some((p) => ENCERRAM[ctx.setor].includes(p));
    case "grupoGerir":
      return gerente || u.papeis.includes(Papel.SECRETARIA_ACADEMICA);
    case "bloquear":
      return gerente;
    case "perfilNumero":
      return admin;
    case "desvincular":
      // D8: só o Administrador ou o gerente do setor do atendimento (ehGerenteDoSetor já inclui o administrador).
      return TIPOS_DESVINCULAVEIS[ctx.setor].length > 0 && gerenteDoSetor;
  }
}
