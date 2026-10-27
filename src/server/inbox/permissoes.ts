import { Papel } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { capacidadesCrm } from "@/server/crm/permissoes";
import { capacidadesAria } from "@/server/aria/permissoes-tela";
import { ehGerenteDoSetor, setoresVisiveisNoInbox, type Setor } from "@/server/whatsapp/setor";

export type AcaoInbox = "enviar" | "editarApagar" | "encaminhar" | "preferenciaPessoal" | "assumir" | "devolver" | "atribuir" | "transferir" | "convidar" | "encerrar" | "notaInterna" | "agendar" | "grupoGerir" | "bloquear" | "perfilNumero" | "desvincular";

export interface ContextoAcao { setor: Setor; responsavelId: string | null; autorMensagemId?: string | null; participante?: boolean;
  linhaComercial?: boolean; donoLinhaId?: string | null }

export type TipoVinculoContato = "aluno" | "responsavel" | "lead";

export const TIPOS_DESVINCULAVEIS: Readonly<Record<Setor, readonly TipoVinculoContato[]>> = {
  COMERCIAL: ["lead"],
  SECRETARIA: ["aluno", "responsavel"],
  FINANCEIRO: ["aluno", "responsavel"],
  PEDAGOGICO: [],
};

const GERENTES: Papel[] = [Papel.GERENTE_COMERCIAL, Papel.GERENTE_PEDAGOGICO];

const ENCERRAM: Record<Setor, Papel[]> = {
  COMERCIAL: [Papel.GERENTE_COMERCIAL],
  FINANCEIRO: [Papel.FINANCEIRO],
  SECRETARIA: [Papel.SECRETARIA_ACADEMICA],
  PEDAGOGICO: [Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA],
};

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
      return TIPOS_DESVINCULAVEIS[ctx.setor].length > 0 && gerenteDoSetor;
  }
}


export type CapacidadesPainel = {
  veLead: boolean;
  verContato: boolean;
  editarContato: boolean;
  editarTags: boolean;
  criarTag: boolean;
  moverEtapa: boolean;
  tarefas: boolean;
  tarefasEquipe: boolean;
  desfazerAria: boolean;
  verEmpresa: boolean;
};

export function capacidadesPainel(u: Pick<UsuarioSessao, "id" | "papeis">, ctx: { finalidade: Setor; veLead: boolean }): CapacidadesPainel {
  const crm = capacidadesCrm(u.papeis);
  const comercialVisivel = ctx.finalidade === "COMERCIAL" && ctx.veLead;
  const editarContato = comercialVisivel && crm.has("contatos.editar");
  return {
    veLead: ctx.veLead,
    verContato: crm.has("contatos.ver"),
    editarContato,
    editarTags: editarContato,
    criarTag: editarContato && crm.has("carteira.equipe"),
    moverEtapa: comercialVisivel && crm.has("funil.mover"),
    tarefas: crm.has("tarefas.ver"),
    tarefasEquipe: crm.has("tarefas.equipe"),
    desfazerAria: comercialVisivel && capacidadesAria(u).has("decidirHistorico"),
    verEmpresa: u.papeis.includes(Papel.ADMINISTRADOR) || u.papeis.includes(Papel.FINANCEIRO),
  };
}
