import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { CondicoesEncerramento } from "./CondicoesEncerramento";

export async function CondicoesEncerramentoLista({ ids, autorId, administrador }: { ids: string[]; autorId: string; administrador: boolean }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const matriculas = await prisma.matricula.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, codigo: true, status: true, ativadaEm: true, contratoOk: true, confirmacaoContratoEm: true, contratoDocumentoId: true,
      processosAssinatura: { where: { estado: "ENVIADO", referenciaExterna: { not: null }, conclusao: null }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { id: true, artefatoId: true } },
      condicoesEncerramento: { orderBy: { versao: "desc" }, select: {
        id: true, versao: true, status: true, regras: true, motivo: true, motivoDecisao: true, preparadorId: true,
        documento: { select: { nome: true, url: true } }, artefatoContratual: { select: { id: true } }, processoAssinatura: { select: { id: true, estado: true, referenciaExterna: true, conclusao: { select: { id: true } } } }, preparador: { select: { nome: true } }, decisor: { select: { nome: true } },
      } },
    },
    orderBy: { criadoEm: "desc" },
  });
  return <div className="space-y-4">{matriculas.map((m) => <CondicoesEncerramento key={m.id} matriculaId={m.id} codigo={m.codigo ?? m.id} documentoId={m.contratoOk && m.confirmacaoContratoEm ? m.contratoDocumentoId : null} autorId={autorId} administrador={administrador} fontesOriginaisEnviados={!m.ativadaEm && ["RASCUNHO", "AGUARDANDO"].includes(m.status) ? m.processosAssinatura.map((processo) => ({ processoAssinaturaId: processo.id, artefatoContratualId: processo.artefatoId })) : []} versoes={m.condicoesEncerramento.map((versao) => ({ ...versao, processoAssinatura: versao.processoAssinatura && { id: versao.processoAssinatura.id, estado: versao.processoAssinatura.estado, envioConfirmado: !!versao.processoAssinatura.referenciaExterna, conclusaoRegistrada: !!versao.processoAssinatura.conclusao } }))} />)}</div>;
}
