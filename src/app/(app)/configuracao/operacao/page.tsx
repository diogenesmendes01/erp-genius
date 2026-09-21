import { PrazosPortalFormulario } from "./PrazosPortalFormulario";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { OperacaoFormulario } from "./OperacaoFormulario";
import { PrazosEntregaReposicaoFormulario } from "./PrazosEntregaReposicaoFormulario";
import Link from "next/link";

export default async function OperacaoPage() {
  await exigirSessaoPagina(Papel.ADMINISTRADOR);
  const config = await prisma.configuracaoOperacional.findUnique({ where: { id: "escola" } });
  return <section className="max-w-2xl space-y-5"><h2 className="text-lg font-medium">Configuração operacional</h2><OperacaoFormulario prazoReservaMinutos={config?.prazoReservaMinutos ?? null} exigirPrimeiraMensalidade={config?.exigirPrimeiraMensalidade ?? false} prazoConferenciaHoras={config?.prazoConferenciaHoras ?? 48} fusoInstitucional={config?.fusoInstitucional ?? null} /><PrazosPortalFormulario valores={{ prazoSessaoPortalAlunoMinutos: config?.prazoSessaoPortalAlunoMinutos ?? null, prazoConvitePortalAlunoMinutos: config?.prazoConvitePortalAlunoMinutos ?? null, prazoRecuperacaoPortalAlunoMinutos: config?.prazoRecuperacaoPortalAlunoMinutos ?? null, prazoValidacaoEmailPortalAlunoMinutos: config?.prazoValidacaoEmailPortalAlunoMinutos ?? null }} /><PrazosEntregaReposicaoFormulario valores={{ prazoPrimeiraEntregaReposicaoMinutos: config?.prazoPrimeiraEntregaReposicaoMinutos ?? null, prazoRespostaCorrecaoReposicaoMinutos: config?.prazoRespostaCorrecaoReposicaoMinutos ?? null }} /><Link className="inline-block text-sm text-brand-700 underline" href="/configuracao/operacao/avisos-diario">Configurar avisos do diário</Link></section>;
}
