import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra } from "@/server/_shared";
import { despacharAcessoPortalResend } from "./envio-resend";

const Entrada = z.object({ cursor: z.string().trim().min(1).max(100).optional() }).strict();

type AmbienteEnvioPortal = {
  EMAIL_PORTAL_ENVIO_ENABLED?: string;
  RESEND_API_KEY?: string;
  EMAIL_INSTITUCIONAL_REMETENTE?: string;
  PORTAL_ALUNO_URL_PUBLICA?: string;
};

export type ResultadoProcessamentoEnviosPortalAluno = {
  habilitado: boolean;
  processados: number;
  aceitosPeloProvedor: number;
  incertos: number;
  pendencias: number;
  proximoCursor: string | null;
};

/**
 * Worker interno chamado pelo cron protegido: processa somente PREPARADO.
 * Cada despacho faz seu próprio claim durável; INCERTO nunca volta para esta fila.
 */
export async function processarEnviosPortalAluno(
  input: { cursor?: string } = {},
  opcoes: { ambiente?: AmbienteEnvioPortal } = {},
): Promise<ResultadoProcessamentoEnviosPortalAluno> {
  const dados = Entrada.parse(input);
  const ambiente = opcoes.ambiente ?? process.env as AmbienteEnvioPortal;
  if (ambiente.EMAIL_PORTAL_ENVIO_ENABLED !== "true") {
    return { habilitado: false, processados: 0, aceitosPeloProvedor: 0, incertos: 0, pendencias: 0, proximoCursor: null };
  }

  const registros = await prisma.solicitacaoEnvioPortalAluno.findMany({
    where: { situacao: "PREPARADO", ...(dados.cursor ? { id: { gt: dados.cursor } } : {}) },
    orderBy: { id: "asc" },
    take: 21,
    select: { id: true },
  });
  let processados = 0;
  let aceitosPeloProvedor = 0;
  let incertos = 0;
  let pendencias = 0;

  for (const registro of registros.slice(0, 20)) {
    try {
      // Deliberadamente serial: o claim muda PREPARADO para INCERTO antes de I/O.
      const resultado = await despacharAcessoPortalResend(registro.id, { ambiente });
      processados += 1;
      if (resultado.situacao === "ENVIADO") aceitosPeloProvedor += 1;
      else incertos += 1;
    } catch (erro) {
      if (erro instanceof ErroRegra) {
        pendencias += 1;
        continue;
      }
      throw erro;
    }
  }

  return {
    habilitado: true,
    processados,
    aceitosPeloProvedor,
    incertos,
    pendencias,
    proximoCursor: registros.length > 20 ? registros[19]!.id : null,
  };
}
