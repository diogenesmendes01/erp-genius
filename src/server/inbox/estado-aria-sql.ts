import { Prisma } from "@prisma/client";

/** Relações singulares: uma linha por atendimento, nunca um JOIN de filhos. Aliases internos fixos. */
export const RELACOES_ESTADO_ARIA = Prisma.sql`
  JOIN "ConversaWhatsApp" c ON c."id" = a."conversaId"
  JOIN "NumeroWhatsApp" n ON n."id" = c."numeroId"
  LEFT JOIN "ContatoWhatsApp" ct ON ct."id" = c."contatoId"`;

/** Predicado correlacionado equivalente ao produtor342, sem materializar IDs. */
export function handoffPendenteEmSql(): Prisma.Sql {
  return Prisma.sql`(a."iaPausaMotivo" = 'HANDOFF' AND a."iaPausadaEm" IS NOT NULL AND a."encerradoEm" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "MensagemWhatsApp" m
      WHERE m."atendimentoId" = a."id" AND m."direcao" = 'SAIDA'
        AND m."origem" IN ('HUMANO', 'CELULAR') AND m."criadoEm" > a."iaPausadaEm")
    AND NOT EXISTS (SELECT 1 FROM "Evento" e
      WHERE e."agregadoTipo" = 'AtendimentoWhatsApp' AND e."agregadoId" = a."id"
        AND e."tipo" = 'AtendimentoAssumido' AND e."criadoEm" > a."iaPausadaEm"))`;
}
export function sugestaoPendenteEmSql(agora: Date): Prisma.Sql {
  return Prisma.sql`EXISTS (SELECT 1 FROM "AcaoAgenteIA" s
    WHERE s."atendimentoId" = a."id" AND s."status" = 'SUGERIDA'
      AND (s."expiraEm" IS NULL OR s."expiraEm" > ${agora.toISOString()}::timestamp(3)))`;
}

/** Mesma prioridade da derivação342. Classificação não é autorização e exige os aliases singulares acima. */
export function estadoAriaEmSql(ativa: boolean, agora: Date): Prisma.Sql {
  return Prisma.sql`CASE
    WHEN a."encerradoEm" IS NOT NULL OR c."grupoId" IS NOT NULL THEN NULL
    WHEN ${handoffPendenteEmSql()} THEN ${"handoff"}::text
    WHEN a."iaPausadaEm" IS NOT NULL THEN ${"humano"}::text
    WHEN ${sugestaoPendenteEmSql(agora)} THEN ${"aprovacao"}::text
    WHEN ${ativa}::boolean AND a."finalidade" = 'COMERCIAL' AND a."iaPausadaEm" IS NULL
      AND n."donoId" IS NULL AND (c."contatoId" IS NULL OR ct."optOutEm" IS NULL) THEN ${"ia"}::text
    WHEN a."responsavelId" IS NOT NULL THEN ${"humano"}::text ELSE NULL END`;
}
