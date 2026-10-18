import { Papel } from "@prisma/client";

// Configurações do CRM por rota (Fase 5F): cada seção é uma página com o próprio guard, que repete
// os papéis daqui (secoes.test.ts trava a igualdade). A IA é só do administrador (chave, orçamento,
// modelos); as demais também abrem para o Gerente Comercial.
export type SecaoCrmId = "distribuicao" | "tags-campos" | "respostas" | "metas" | "ia";

export interface SecaoCrm {
  id: SecaoCrmId;
  label: string;
  papeis: Papel[];
}

const ADMIN_E_GERENTE = [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL];

export const SECOES_CRM: SecaoCrm[] = [
  { id: "distribuicao", label: "Distribuição e SLA", papeis: ADMIN_E_GERENTE },
  { id: "tags-campos", label: "Tags e campos", papeis: ADMIN_E_GERENTE },
  { id: "respostas", label: "Respostas rápidas", papeis: ADMIN_E_GERENTE },
  { id: "metas", label: "Metas", papeis: ADMIN_E_GERENTE },
  { id: "ia", label: "IA", papeis: [Papel.ADMINISTRADOR] },
];

export const hrefSecaoCrm = (id: SecaoCrmId) => `/configuracao/crm/${id}`;

export function secoesCrmParaPapeis(papeis: Papel[]): SecaoCrm[] {
  return SECOES_CRM.filter((s) => s.papeis.some((p) => papeis.includes(p)));
}
