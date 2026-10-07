import { Papel } from "@prisma/client";
import type { SecaoArea } from "@/lib/nav";

// Sub-seções de /diario (docs/42-auditoria-frontend-ux.md, E2): antes, a raiz abria com uma fila de
// links soltos e as sub-telas não tinham caminho de uma para a outra. Viram as abas do layout.
// Papéis = os do exigirSessaoPagina de cada página (secoes.test.ts confere); Administrador vê todas.
//
// A raiz é `exato`: /diario/encontros/[id]/… não acende "Aulas". /diario/regularizacoes e
// /diario/regularizacoes-gravacao compartilham prefixo de string, não de segmento — a borda de
// segmento do hrefDaAbaAtiva separa as duas.

const { SECRETARIA_ACADEMICA: SEC, GERENTE_PEDAGOGICO: GP, PROFESSOR: PROF, ADMINISTRADOR: ADM } = Papel;

export const SECOES_DIARIO: SecaoArea[] = [
  { href: "/diario", label: "Aulas", exato: true, papeis: [PROF, GP] },
  { href: "/diario/encontros", label: "Encontros", papeis: [PROF, GP, SEC] },
  { href: "/diario/pendencias", label: "Pendências", papeis: [PROF, GP, ADM] },
  { href: "/diario/regularizacoes", label: "Regularizações de aula", papeis: [PROF, GP] },
  { href: "/diario/reposicoes", label: "Reposições", papeis: [PROF] },
  { href: "/diario/excecoes-gravacao", label: "Exceções de gravação", papeis: [PROF, GP] },
  { href: "/diario/regularizacoes-gravacao", label: "Regularizações de gravação", papeis: [GP, ADM] },
];
