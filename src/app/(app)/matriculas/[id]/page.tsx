import Link from "next/link";
import { notFound } from "next/navigation";
import { STATUS_MATRICULA_LABEL } from "@/lib/labels";
import { carregarCabecalho } from "./carregar-cabecalho";
import { secoesParaPapeis } from "./secoes";

// Hub da matrícula (E2): antes /matriculas/[id] dava 404 — encurtar a URL de qualquer uma das 33
// telas caía na página padrão do Next. Aqui o operador vê de quem é a matrícula e escolhe a seção.
export default async function MatriculaHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { usuario, cabecalho } = await carregarCabecalho(id);
  if (!cabecalho) notFound();
  const secoes = secoesParaPapeis(usuario.papeis, id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium">Matrícula {cabecalho.codigo ?? ""}</h1>
      <p className="text-sm text-gray-600">
        {cabecalho.aluno} · {cabecalho.produto} · {STATUS_MATRICULA_LABEL[cabecalho.status]}
      </p>
      {secoes.length === 0 ? (
        <p className="text-sm text-gray-600">Nenhuma seção desta matrícula está disponível para a sua função.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {secoes.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="block rounded-md border border-gray-200 bg-surface px-4 py-3 text-sm hover:bg-gray-50">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
