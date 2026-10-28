import type { Metadata } from "next";
import Link from "next/link";
import { STATUS_MATRICULA_LABEL } from "@/lib/labels";
import { SubTabs } from "@/components/SubTabs";
import { carregarCabecalho } from "./carregar-cabecalho";
import { secoesParaPapeis } from "./secoes";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { cabecalho } = await carregarCabecalho(id);
  return { title: cabecalho ? `${cabecalho.codigo ?? "Matrícula"} · ${cabecalho.aluno}` : "Matrícula" };
}

export default async function MatriculaLayout({ children, params }: Props & { children: React.ReactNode }) {
  const { id } = await params;
  const { usuario, cabecalho } = await carregarCabecalho(id);
  if (!cabecalho) return <>{children}</>;

  return (
    <div>
      <section aria-label="Matrícula" className="mb-5 border-b border-gray-200 pb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Link href={`/matriculas/${id}`} className="font-medium text-gray-900 hover:underline">
            {cabecalho.codigo ?? "Matrícula sem código"}
          </Link>
          <span aria-hidden="true" className="text-gray-300">·</span>
          <Link href={`/alunos/${cabecalho.alunoId}`} className="text-brand-700 hover:underline">{cabecalho.aluno}</Link>
          <span aria-hidden="true" className="text-gray-300">·</span>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-gray-700">{STATUS_MATRICULA_LABEL[cabecalho.status]}</span>
          <span className="text-gray-500">{cabecalho.produto}</span>
        </div>
        <SubTabs tabs={secoesParaPapeis(usuario.papeis, id, cabecalho.alunoId)} ariaLabel="Seções da matrícula" />
      </section>
      {children}
    </div>
  );
}
