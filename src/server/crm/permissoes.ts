import { Papel } from "@prisma/client";
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
  [Papel.FINANCEIRO]: ["tarefas.ver", "comissoes.ver", "comissoes.equipe", "comissoes.estornar"],
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

export { setoresDoUsuario } from "./setores-papel";
