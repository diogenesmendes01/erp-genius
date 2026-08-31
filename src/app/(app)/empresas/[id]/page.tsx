import { notFound } from "next/navigation";
import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { competenciasFaturaveis, obterEmpresa } from "@/server/empresas/consultas";
import { listarProdutosParaMatricula } from "@/server/matricula/consultas";
import { FichaEmpresa } from "./FichaEmpresa";

// B2B — ficha da empresa (Fase 2, doc 03): dados do contrato corporativo, RELATÓRIO POR
// COLABORADOR, matrículas em LOTE e faturas únicas (fechar/pagar/cancelar).

const PAPEIS: Papel[] = [Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];

export default async function EmpresaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const papeis = await exigirPapelLeitura(...PAPEIS);
  if (!papeis) return <AcessoNegado recurso="as empresas (B2B)" />;

  const dados = await obterEmpresa(id);
  if (!dados) notFound();
  const [produtos, competencias] = await Promise.all([
    listarProdutosParaMatricula(),
    competenciasFaturaveis(id),
  ]);

  const podePagar = papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.FINANCEIRO) || papeis.includes(Papel.SECRETARIA_ACADEMICA);

  return (
    <FichaEmpresa
      empresa={dados.empresa}
      colaboradores={dados.colaboradores}
      faturas={dados.faturas}
      produtos={produtos.map((p) => ({ id: p.id, label: `${p.idioma.nome} · ${p.modalidade.nome}` }))}
      competencias={competencias}
      podePagar={podePagar}
    />
  );
}
