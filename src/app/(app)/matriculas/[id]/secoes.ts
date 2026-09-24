import { Papel } from "@prisma/client";

// Seções de uma matrícula (docs/42-auditoria-frontend-ux.md, E2): viram as abas do cabeçalho do
// registro e a lista do hub /matriculas/[id]. Os papéis de cada seção são os MESMOS do
// exigirSessaoPagina da página — secoes.test.ts lê cada page.tsx e confere, então uma aba nunca
// oferece uma página que o papel não abre. Administrador passa sempre (como no guard).
//
// Sub-telas podem abrir para mais papéis que a aba da sua seção. Ex.: as Alçadas do aditivo
// (contrato/aditivos/[propostaId]/alcadas) abrem para Financeiro, Gerente comercial e Gerência
// pedagógica, mas a aba Contrato é só da Secretaria — ofertá-la levaria a uma página que eles não
// abrem. Nessas URLs eles veem o cabeçalho sem aba marcada, e é intencional.

export type SecaoMatricula = { caminho: string; rotulo: string; papeis: Papel[] };

const { VENDEDOR: VEND, GERENTE_COMERCIAL: GC, SECRETARIA_ACADEMICA: SEC, FINANCEIRO: FIN, GERENTE_PEDAGOGICO: GP, ADMINISTRADOR: ADM } = Papel;

/** Na ordem do fluxo: contratação → contrato → condições financeiras → operação → saída. */
export const SECOES_MATRICULA: SecaoMatricula[] = [
  { caminho: "preparacao", rotulo: "Preparação", papeis: [VEND, GC, SEC] },
  { caminho: "reserva", rotulo: "Reserva", papeis: [VEND, GC, SEC] },
  { caminho: "nova-reserva", rotulo: "Nova reserva", papeis: [SEC] },
  { caminho: "contrato", rotulo: "Contrato", papeis: [SEC] },
  { caminho: "emissao", rotulo: "Emissão", papeis: [SEC] },
  { caminho: "pagador", rotulo: "Pagador", papeis: [SEC, FIN] },
  { caminho: "condicoes", rotulo: "Condições de entrada", papeis: [SEC, FIN] },
  { caminho: "condicoes-horas", rotulo: "Condições por hora", papeis: [SEC, FIN] },
  { caminho: "continuidade-mensal", rotulo: "Continuidade mensal", papeis: [SEC, FIN] },
  { caminho: "entrada-particular", rotulo: "Entrada particular", papeis: [SEC, FIN] },
  { caminho: "autorizacoes-comunicacao", rotulo: "Comunicação", papeis: [SEC, ADM] },
  { caminho: "disponibilidade-oferta", rotulo: "Disponibilidade", papeis: [SEC, GP, FIN] },
  { caminho: "indisponibilidade-oferta", rotulo: "Indisponibilidade", papeis: [SEC, GP, FIN, ADM] },
  { caminho: "ocorrencias-financeiras", rotulo: "Ocorrências financeiras", papeis: [FIN] },
  { caminho: "fechamentos-horas", rotulo: "Fechamentos de horas", papeis: [FIN] },
  { caminho: "desistencia", rotulo: "Desistência", papeis: [SEC, ADM] },
];

/** Papéis que abrem ao menos uma seção — o guard do layout e do hub. */
export const PAPEIS_MATRICULA: Papel[] = [...new Set(SECOES_MATRICULA.flatMap((s) => s.papeis))];

export function secoesParaPapeis(papeis: Papel[], matriculaId: string) {
  const admin = papeis.includes(ADM);
  return SECOES_MATRICULA
    .filter((s) => admin || s.papeis.some((p) => papeis.includes(p)))
    .map((s) => ({ href: `/matriculas/${matriculaId}/${s.caminho}`, label: s.rotulo }));
}
