import { Papel } from "@prisma/client";
import { ErroPermissao, type UsuarioSessao } from "../_shared";
import type { ConfigAria } from "./config-schema";

export type CapacidadeAria =
  | "ver"
  | "editarComportamento"
  | "editarMatriz"
  | "editarConfianca"
  | "publicar"
  | "pausar"
  | "ligarSupervisao"
  | "desligarSupervisao"
  | "mudarEstado"
  | "decidirHistorico"
  | "verProvedor";

const TODAS: CapacidadeAria[] = [
  "ver", "editarComportamento", "editarMatriz", "editarConfianca", "publicar", "pausar",
  "ligarSupervisao", "desligarSupervisao", "mudarEstado", "decidirHistorico", "verProvedor",
];
const GERENTE: CapacidadeAria[] = [
  "ver", "editarComportamento", "publicar", "pausar", "ligarSupervisao", "decidirHistorico",
];

/** DF5-13: Administrador faz tudo; Gerente Comercial opera, mas não muda matriz, estado nem provedor. */
export function capacidadesAria(u: UsuarioSessao): Set<CapacidadeAria> {
  if (u.papeis.includes(Papel.ADMINISTRADOR)) return new Set(TODAS);
  if (u.papeis.includes(Papel.GERENTE_COMERCIAL)) return new Set(GERENTE);
  return new Set();
}

function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => igual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** Lança ErroPermissao se o papel não pode fazer a alteração `antes` → `depois`. */
export function validarAlteracaoPorPapel(
  u: UsuarioSessao & { limiteDescontoTaxaPct: number | null; limiteDescontoMensalidadePct: number | null },
  antes: ConfigAria,
  depois: ConfigAria,
): void {
  const cap = capacidadesAria(u);
  if (!cap.has("ver")) throw new ErroPermissao("Sem acesso à configuração da Aria.");
  if (cap.has("editarMatriz") && cap.has("editarConfianca")) return; // Administrador

  if (!igual(antes.matriz, depois.matriz)) {
    throw new ErroPermissao("Só o Administrador altera a matriz de autonomia da Aria.");
  }
  const a = antes.confianca;
  const d = depois.confianca;
  if (d.executaAPartirDe < a.executaAPartirDe || d.transfereAbaixoDe < a.transfereAbaixoDe) {
    throw new ErroPermissao("O Gerente Comercial não pode afrouxar as faixas de confiança, só aumentá-las.");
  }
  if (d.expiracaoSugestaoMin !== a.expiracaoSugestaoMin || d.acaoExpiracao !== a.acaoExpiracao) {
    if (!cap.has("editarConfianca")) {
      throw new ErroPermissao("Só o Administrador altera a expiração das sugestões.");
    }
  }
  const tetos = {
    MATRICULA: u.limiteDescontoTaxaPct ?? 0,
    MENSALIDADE: u.limiteDescontoMensalidadePct ?? 0,
  } as const;
  for (const tipo of ["MATRICULA", "MENSALIDADE"] as const) {
    const novo = depois.politicas[tipo].descontoComAprovacaoPct;
    if (novo !== antes.politicas[tipo].descontoComAprovacaoPct && novo > tetos[tipo]) {
      throw new ErroPermissao(`O desconto com aprovação de ${tipo === "MATRICULA" ? "matrícula" : "mensalidade"} excede a sua alçada.`);
    }
  }
}
