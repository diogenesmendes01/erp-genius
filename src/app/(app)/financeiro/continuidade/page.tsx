import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarFilaContinuidadeMensal } from "@/server/matricula/continuidade-fila";
import { FilaContinuidadeMensal } from "./FilaContinuidadeMensal";
import { VoltarPara } from "@/components/VoltarPara";
import { Paginacao } from "@/components/Paginacao";
import { hrefLista, lerPagina, type ParametrosUrl } from "@/lib/pagina-url";

export default async function FilaContinuidadeMensalPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const pagina = lerPagina(await searchParams);
  const resultado = await consultarFilaContinuidadeMensal({ pagina });
  if (!resultado.ok || !resultado.dado) {
    return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  }

  const { itens, temProxima } = resultado.dado;
  return <section className="space-y-4">
    <VoltarPara href="/financeiro" />
    <h1 className="text-2xl font-medium">Fila de continuidade mensal</h1>
    <p>Consulte as condições de cada matrícula antes de qualquer providência. Esta tela não emite cobranças nem atesta que o processamento recorrente esteja ativo.</p>
    <FilaContinuidadeMensal itens={itens} pagina={pagina} />
    <Paginacao pagina={pagina} temProxima={temProxima} href={(p) => hrefLista("/financeiro/continuidade", { pagina: p })} rotulo="Páginas da fila de continuidade mensal" />
  </section>;
}
