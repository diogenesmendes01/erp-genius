import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/server/_shared";

/** Link só aparece para quem tem a concessão; a rota revalida independentemente. */
export async function ExportarPlanilha({ tipo }: { tipo: "alunos" | "leads" }) {
  const usuario = await exigirSessao();
  const atual = await prisma.usuario.findUnique({ where: { id: usuario.id }, select: { permissoes: true } });
  if (!usuario.papeis.includes(Papel.ADMINISTRADOR) && !atual?.permissoes.includes(`dados.exportar_${tipo}`)) return null;
  return <a href={`/api/exportacoes/${tipo}`} className="inline-flex rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Exportar planilha</a>;
}
