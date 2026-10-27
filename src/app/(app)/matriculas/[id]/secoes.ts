import { Papel } from "@prisma/client";

export type SecaoMatricula = { caminho: string; rotulo: string; papeis: Papel[]; contextoAluno?: true };

const { VENDEDOR: VEND, GERENTE_COMERCIAL: GC, SECRETARIA_ACADEMICA: SEC, FINANCEIRO: FIN, GERENTE_PEDAGOGICO: GP, ADMINISTRADOR: ADM } = Papel;

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
  { caminho: "fechamentos-horas", rotulo: "Fechamentos de horas", papeis: [FIN], contextoAluno: true },
  { caminho: "desistencia", rotulo: "Desistência", papeis: [SEC, ADM] },
];

export const PAPEIS_MATRICULA: Papel[] = [...new Set(SECOES_MATRICULA.flatMap((s) => s.papeis))];

export function secoesParaPapeis(papeis: Papel[], matriculaId: string, alunoId?: string | null): { href: string; label: string; prefixo?: string }[] {
  const admin = papeis.includes(ADM);
  return SECOES_MATRICULA
    .filter((s) => admin || s.papeis.some((p) => papeis.includes(p)))
    .filter((s) => !s.contextoAluno || !!alunoId)
    .map((s) => {
      const caminho = `/matriculas/${matriculaId}/${s.caminho}`;
      return s.contextoAluno && alunoId ? { href: `${caminho}?aluno=${encodeURIComponent(alunoId)}`, label: s.rotulo, prefixo: caminho } : { href: caminho, label: s.rotulo };
    });
}
