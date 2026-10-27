import { Papel } from "@prisma/client";
import type { SecaoArea } from "@/lib/nav";

const { SECRETARIA_ACADEMICA: SEC, GERENTE_PEDAGOGICO: GP, PROFESSOR: PROF, ADMINISTRADOR: ADM } = Papel;

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
  { href: "/academico/modalidades/quantidade", label: "Quantidade de aulas", prefixo: "/academico/modalidades", papeis: [SEC, GP] },
  { href: "/academico/calendario", label: "Calendário", papeis: [SEC, GP] },
  { href: "/academico/admissoes", label: "Admissões", papeis: [SEC, GP] },
];
