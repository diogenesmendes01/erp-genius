// Sem "use server": leitura usada dentro da transação do inbound (status-atendimento.ts).
import type { Prisma } from "@prisma/client";
import { feriadosDoCalendarioEscolar, type FeriadoEscola } from "./horario-atendimento";

/**
 * Feriados da escola para o SLA: períodos `FERIADO` da versão APROVADA mais recente do calendário escolar
 * institucional (o mesmo que a agenda usa; Acadêmico › Calendário). Proposta pendente ou reprovada não vale.
 * `desde` (AAAA-MM-DD, dia civil da escola) descarta os feriados já passados.
 *
 * Sem a âncora advisory `calendario-escola`: é só leitura de versões imutáveis (trigger
 * `versao_calendario_preservada`), e travar a âncora serializaria todo inbound com as ações da agenda. Um
 * prazo calculado durante a publicação de uma versão usa a anterior, o mesmo efeito de um prazo gravado antes
 * dela (prazos gravados não são recalculados; D7 do plano do SLA).
 */
export async function feriadosDaEscola(db: Pick<Prisma.TransactionClient, "versaoCalendarioEscolar">, desde?: string): Promise<FeriadoEscola[]> {
  const vigente = await db.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" }, select: { periodos: true } });
  return vigente ? feriadosDoCalendarioEscolar(vigente.periodos, desde) : [];
}
