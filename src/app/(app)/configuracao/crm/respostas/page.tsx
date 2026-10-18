import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { setoresEditaveis } from "@/server/crm-config/distribuicao";
import { RespostasPainel } from "./RespostasPainel";

export default async function Pagina() {
  const usuario = await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
  const ts = await prisma.templateWhatsApp.findMany({
    where: { tipo: "RESPOSTA_RAPIDA", arquivadoEm: null },
    orderBy: { atalho: "asc" },
    select: { id: true, atalho: true, titulo: true, corpo: true, setor: true, ariaPodeUsar: true },
  });
  const respostas = ts.map((t) => ({ id: t.id, atalho: t.atalho ?? "", titulo: t.titulo ?? t.atalho ?? "", corpo: t.corpo, setor: t.setor, ariaPodeUsar: t.ariaPodeUsar }));
  const setoresPermitidos = setoresEditaveis(usuario.papeis).filter((s) => usuario.papeis.includes(Papel.ADMINISTRADOR) || s === "COMERCIAL");
  return (
    <section aria-labelledby="titulo-secao">
      <h2 id="titulo-secao" className="text-lg font-semibold">Respostas rápidas</h2>
      <p className="mt-1 text-sm text-gray-600">Textos prontos que o atendente chama digitando / no Inbox. Respostas sem setor valem para todos.</p>
      <RespostasPainel respostas={respostas} setoresPermitidos={setoresPermitidos} />
    </section>
  );
}
