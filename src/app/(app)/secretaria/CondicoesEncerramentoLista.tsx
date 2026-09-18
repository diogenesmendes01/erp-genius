import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { CondicoesEncerramento } from "./CondicoesEncerramento";

export async function CondicoesEncerramentoLista({ ids, autorId, administrador }: { ids: string[]; autorId: string; administrador: boolean }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const matriculas = await prisma.matricula.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, codigo: true, contratoOk: true, confirmacaoContratoEm: true, contratoDocumentoId: true,
      condicoesEncerramento: { orderBy: { versao: "desc" }, select: {
        id: true, versao: true, status: true, regras: true, motivo: true, motivoDecisao: true, preparadorId: true,
        documento: { select: { nome: true, url: true } }, artefatoContratual: { select: { id: true, pdfHash: true } }, processoAssinatura: { select: { id: true, estado: true, referenciaExterna: true } }, preparador: { select: { nome: true } }, decisor: { select: { nome: true } },
      } },
    },
    orderBy: { criadoEm: "desc" },
  });
  return <div className="space-y-4">{matriculas.map((m) => <CondicoesEncerramento key={m.id} matriculaId={m.id} codigo={m.codigo ?? m.id} documentoId={m.contratoOk && m.confirmacaoContratoEm ? m.contratoDocumentoId : null} autorId={autorId} administrador={administrador} versoes={m.condicoesEncerramento} />)}</div>;
}
