import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { VoltarPara } from "@/components/VoltarPara";
export default async function ModalidadesQuantidadePage() {
 await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
 const modalidades = await prisma.modalidade.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, aulasPorNivel: true } });
 return <main className="space-y-4"><VoltarPara href="/academico" /><h1 className="text-2xl font-medium">Quantidade de aulas por modalidade</h1><p>Escolha uma modalidade para preparar a revisão conjunta antes de mudar a meta.</p><ul className="space-y-2">{modalidades.map((m) => <li className="rounded border p-3" key={m.id}><Link className="underline text-brand-700" href={`/academico/modalidades/${m.id}/quantidade`}>{m.nome}</Link> · {m.aulasPorNivel ?? "sem quantidade configurada"}</li>)}</ul></main>;
}
