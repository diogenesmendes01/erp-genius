import { Papel } from "@prisma/client";
import type { SecaoArea } from "@/lib/nav";

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
