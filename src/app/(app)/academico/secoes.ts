import { Papel } from "@prisma/client";
import type { SecaoArea } from "@/lib/nav";

// Sub-seções de /academico (docs/42-auditoria-frontend-ux.md, E2 e §5.5 A11): antes, a raiz
// renderizava 12 links soltos ANTES do próprio <h1>, omitia Aproveitamentos e Recuperações, e as 64
// páginas filhas não tinham caminho de uma área para a outra. Viram as abas do layout da área.
//
// Os papéis de cada aba são os MESMOS do exigirSessaoPagina da página — secoes.test.ts lê cada
// page.tsx e confere, então a aba nunca oferece uma página que o papel não abre. Administrador vê
// todas (no guard ele sempre passa).
//
// Prefixos aninhados: a raiz é `exato` (uma sub-tela sem aba própria não acende "Mudanças
// acadêmicas"); "Minhas recuperações" fica dentro de "Recuperações" e vence pelo prefixo mais longo.
// Sub-telas que abrem para papéis que a aba do ramo não tem (ex.: /academico/correcoes/[id] abre
// para o Professor; a aba Correções é só da Gerência pedagógica) mostram a barra sem aba marcada —
// é intencional, igual ao cabeçalho da matrícula.

const { SECRETARIA_ACADEMICA: SEC, GERENTE_PEDAGOGICO: GP, PROFESSOR: PROF, ADMINISTRADOR: ADM } = Papel;

/** Do acompanhamento (solicitações, avaliações) ao planejamento (grades, calendário, admissões). */
export const SECOES_ACADEMICO: SecaoArea[] = [
  { href: "/academico", label: "Mudanças acadêmicas", exato: true, papeis: [SEC, GP, PROF] },
  { href: "/academico/avaliacoes", label: "Avaliações", papeis: [PROF, GP] },
  { href: "/academico/recuperacoes", label: "Recuperações", papeis: [PROF, GP] },
  { href: "/academico/recuperacoes/designadas", label: "Minhas recuperações", papeis: [PROF] },
  { href: "/academico/segundas-chamadas/minhas", label: "Minhas segundas chamadas", papeis: [PROF] },
  { href: "/academico/segundas-chamadas/pendentes-agenda", label: "Segundas chamadas pendentes", papeis: [SEC, GP, ADM] },
  { href: "/academico/segundas-chamadas/agendas", label: "Agendas de segunda chamada", papeis: [SEC, GP, ADM] },
  { href: "/academico/regras", label: "Regras de avaliação", papeis: [GP] },
  { href: "/academico/correcoes", label: "Correções", papeis: [GP] },
  { href: "/academico/equivalencias", label: "Aproveitamentos", papeis: [GP, SEC] },
  { href: "/academico/reposicoes", label: "Reposições", papeis: [SEC, GP, ADM] },
  { href: "/academico/indisponibilidades", label: "Indisponibilidades docentes", papeis: [PROF, SEC, GP] },
  { href: "/academico/grades", label: "Grades", papeis: [SEC, GP] },
  // A página da aba não é a raiz do ramo: /academico/modalidades/[id]/quantidade também é dela.
  { href: "/academico/modalidades/quantidade", label: "Quantidade de aulas", prefixo: "/academico/modalidades", papeis: [SEC, GP] },
  { href: "/academico/calendario", label: "Calendário", papeis: [SEC, GP] },
  { href: "/academico/admissoes", label: "Admissões", papeis: [SEC, GP] },
];
