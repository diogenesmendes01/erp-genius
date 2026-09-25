import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { AlterarQuantidadeAulas } from "./AlterarQuantidadeAulas";
import { VoltarPara } from "@/components/VoltarPara";
export default async function QuantidadeModalidadePage({ params }: { params: Promise<{ id: string }> }) {
 await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO); const { id } = await params;
 const modalidade = await prisma.modalidade.findUnique({ where: { id }, select: { id: true, nome: true, aulasPorNivel: true } });
 if (!modalidade) return <main><VoltarPara href="/academico" /><p role="alert">Modalidade não encontrada.</p></main>;
 return <main className="space-y-5"><VoltarPara href="/academico" /><header><h1 className="text-2xl font-medium">Quantidade de aulas · {modalidade.nome}</h1><p className="text-sm text-gray-600">A configuração só muda após revisão integral, decisão independente e aplicação conjunta.</p></header><AlterarQuantidadeAulas modalidade={modalidade} /></main>;
}
