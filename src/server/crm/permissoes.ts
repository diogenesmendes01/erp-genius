import { Papel, type FinalidadeAtendimentoWhatsApp } from "@prisma/client";
import { ErroPermissao, type UsuarioSessao } from "@/server/_shared/sessao";

export type CapacidadeCrm =
  | "funil.ver"
  | "funil.mover"
  | "funil.atribuir"
  | "carteira.equipe"
  | "carteira.coberturas"
  | "contatos.ver"
  | "contatos.editar"
  | "contatos.mesclar"
  | "contatos.importar"
  | "tarefas.ver"
  | "tarefas.equipe"
  | "comissoes.ver"
  | "comissoes.equipe"
  | "comissoes.estornar";

const TODAS: CapacidadeCrm[] = [
  "funil.ver", "funil.mover", "funil.atribuir",
  "carteira.equipe", "carteira.coberturas",
  "contatos.ver", "contatos.editar", "contatos.mesclar", "contatos.importar",
  "tarefas.ver", "tarefas.equipe",
  "comissoes.ver", "comissoes.equipe", "comissoes.estornar",
];

/**
 * Matriz de capacidades do CRM por papel do ERP.
 * `comissoes.estornar` do FINANCEIRO depende da Q7 (decisão provisória: comissão nasce com a matrícula).
 */
const MATRIZ: Record<Papel, CapacidadeCrm[]> = {
  [Papel.ADMINISTRADOR]: TODAS,
  [Papel.GERENTE_COMERCIAL]: [
    "funil.ver", "funil.mover", "funil.atribuir",
    "carteira.equipe", "carteira.coberturas",
    "contatos.ver", "contatos.editar", "contatos.mesclar", "contatos.importar",
    "tarefas.ver", "tarefas.equipe",
    "comissoes.ver", "comissoes.equipe",
  ],
  [Papel.VENDEDOR]: ["funil.ver", "funil.mover", "contatos.ver", "contatos.editar", "tarefas.ver", "comissoes.ver"],
  [Papel.FINANCEIRO]: ["tarefas.ver", "comissoes.ver", "comissoes.equipe", "comissoes.estornar"], // estornar: Q7
  [Papel.SECRETARIA_ACADEMICA]: ["contatos.ver", "tarefas.ver"],
  [Papel.GERENTE_PEDAGOGICO]: [],
  [Papel.PROFESSOR]: [],
  [Papel.ALUNO]: [],
};

export function capacidadesCrm(papeis: Papel[]): ReadonlySet<CapacidadeCrm> {
  const s = new Set<CapacidadeCrm>();
  for (const p of papeis) for (const c of MATRIZ[p] ?? []) s.add(c);
  return s;
}

export function exigirCapacidadeCrm(usuario: UsuarioSessao, c: CapacidadeCrm): void {
  if (!capacidadesCrm(usuario.papeis).has(c)) {
    throw new ErroPermissao("Você não tem acesso a esta função do CRM.");
  }
}

const SETOR_POR_PAPEL: Record<Papel, FinalidadeAtendimentoWhatsApp[]> = {
  [Papel.ADMINISTRADOR]: ["COMERCIAL", "FINANCEIRO", "SECRETARIA", "PEDAGOGICO"],
  [Papel.GERENTE_COMERCIAL]: ["COMERCIAL"],
  [Papel.VENDEDOR]: ["COMERCIAL"],
  [Papel.FINANCEIRO]: ["FINANCEIRO"],
  [Papel.SECRETARIA_ACADEMICA]: ["SECRETARIA"],
  [Papel.GERENTE_PEDAGOGICO]: ["PEDAGOGICO"],
  [Papel.PROFESSOR]: [],
  [Papel.ALUNO]: [],
};
const ORDEM: FinalidadeAtendimentoWhatsApp[] = ["COMERCIAL", "FINANCEIRO", "SECRETARIA", "PEDAGOGICO"];

/** Setores de atendimento do usuário, derivados do papel, em ordem canônica e sem repetição. */
export function setoresDoUsuario(papeis: Papel[]): FinalidadeAtendimentoWhatsApp[] {
  const s = new Set(papeis.flatMap((p) => SETOR_POR_PAPEL[p] ?? []));
  return ORDEM.filter((x) => s.has(x));
}
