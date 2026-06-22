import { Papel, EtapaLead } from "@prisma/client";
import { ETAPAS_MANUAIS } from "@/server/comercial/schema";

// Regras de negócio PURAS (sem I/O) — fonte única e testável (ver docs/14).

/**
 * Quem pode atribuir um lead a OUTRO vendedor? (doc 09 §Atribuição de leads)
 * Vendedor só pode ser dono de leads que ele mesmo cria — qualquer dono enviado
 * por ele é ignorado pelo servidor. Apenas gerente/admin atribuem a terceiros.
 */
export function podeAtribuirOutroDono(papeis: Papel[]): boolean {
  return papeis.includes(Papel.GERENTE_COMERCIAL) || papeis.includes(Papel.ADMINISTRADOR);
}

/**
 * Define o dono de um lead recém-criado a partir do papel do autor.
 * - Vendedor sem privilégio de atribuição: SEMPRE ele mesmo (ignora o id enviado).
 * - Gerente/admin: usa o vendedor escolhido, ou nenhum (atribuir depois).
 * O backend é a fonte da regra, independentemente do formulário.
 */
export function resolverDonoLead(
  autor: { id: string; papeis: Papel[] },
  vendedorDonoIdSolicitado?: string | null,
): string | null {
  const ehVendedor = autor.papeis.includes(Papel.VENDEDOR);
  if (!podeAtribuirOutroDono(autor.papeis)) {
    return ehVendedor ? autor.id : null;
  }
  return vendedorDonoIdSolicitado || null;
}

/** Comissão = % da taxa de matrícula (doc 10 §3). */
export function calcularComissao(taxa: number, percentual: number): number {
  return (taxa * percentual) / 100;
}

/**
 * Vencimento da mensalidade no dia escolhido, no mês atual + offset (0 = este mês).
 * `agora` injetável para testes determinísticos.
 */
export function vencimentoMensalidade(
  dia: number,
  offset: number,
  agora: Date = new Date(),
): { data: Date; competencia: string } {
  const d = new Date(agora.getFullYear(), agora.getMonth() + offset, dia);
  const competencia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { data: d, competencia };
}

/** O usuário pode mover o lead para esta etapa manualmente? (Perdido/Matriculado têm fluxo próprio.) */
export function ehEtapaManual(etapa: EtapaLead): boolean {
  return ETAPAS_MANUAIS.includes(etapa);
}
