import { notFound } from "next/navigation";
import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { competenciasFaturaveis, obterEmpresa } from "@/server/empresas/consultas";
import { PAPEIS_FICHA_EMPRESA } from "@/server/empresas/papeis";
import { listarProdutosParaMatricula } from "@/server/matricula/consultas";
import { FichaEmpresa } from "./FichaEmpresa";

export default async function EmpresaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const papeis = await exigirPapelLeitura(...PAPEIS_FICHA_EMPRESA);
  if (!papeis) return <AcessoNegado recurso="as empresas (B2B)" />;

  const dados = await obterEmpresa(id);
  if (!dados) notFound();
  const podeOperarB2B = papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.FINANCEIRO);
  // listarProdutosParaMatricula exige vendedor, gerente ou secretaria e lança para o financeiro.
  const podeListarProdutos = papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.VENDEDOR) || papeis.includes(Papel.GERENTE_COMERCIAL) || papeis.includes(Papel.SECRETARIA_ACADEMICA);
  const [produtos, competencias] = await Promise.all([
    podeListarProdutos ? listarProdutosParaMatricula() : Promise.resolve([]),
    podeOperarB2B ? competenciasFaturaveis(id) : Promise.resolve([]),
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
      podeEditar={podeOperarB2B}
    />
  );
}
