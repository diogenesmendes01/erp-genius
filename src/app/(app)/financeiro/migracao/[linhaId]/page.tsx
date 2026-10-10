import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarConciliacaoFinanceiraMigracao } from "@/server/migracao/consultas-financeiras";
import { ConferenciaFinanceiraMigracao } from "./ConferenciaFinanceiraMigracao";
import { EntradaFinanceiraHistorica } from "./EntradaFinanceiraHistorica";
import { consultarEntradasFinanceirasHistoricasMigracao, listarPaisesEntradaFinanceiraHistoricaMigracao } from "@/server/migracao/entrada-financeira-historica";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";
import { Paginacao } from "@/components/Paginacao";
import { hrefLista, lerPagina, type ParametrosUrl } from "@/lib/pagina-url";

/** Cada coleção da conciliação tem a própria página; o link de uma mantém as páginas das outras. */
type Chave = "pagina" | "paginaRecebimentos" | "paginaPagadores" | "paginaPropostas";

export default async function ConciliacaoFinanceiraPage({ params, searchParams }: { params: Promise<{ linhaId: string }>; searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.FINANCEIRO);
  const [{ linhaId }, busca] = await Promise.all([params, searchParams]);
  const paginas = { pagina: lerPagina(busca), paginaRecebimentos: lerPagina(busca, "paginaRecebimentos"), paginaPagadores: lerPagina(busca, "paginaPagadores"), paginaPropostas: lerPagina(busca, "paginaPropostas") };
  const [resultado, preferencia] = await Promise.all([
    consultarConciliacaoFinanceiraMigracao({ linhaId, ...paginas }),
    consultarPreferenciaFusoEquipe(),
  ]);
  const inicio = "/financeiro/migracao/" + encodeURIComponent(linhaId);
  if (!resultado.ok || !resultado.dado) return <section className="space-y-3"><VoltarPara href="/financeiro" /><p role="alert">{resultado.ok ? "Linha financeira não encontrada ou sem identidade de origem." : resultado.erro}</p><Link href={inicio}>Reiniciar consulta</Link></section>;
  const dados = resultado.dado;
  const [entradas, paises] = await Promise.all([consultarEntradasFinanceirasHistoricasMigracao(dados.linha.id), listarPaisesEntradaFinanceiraHistoricaMigracao()]);
  const href = (chave: Chave) => (p: number) => hrefLista(inicio, { ...paginas, [chave]: p });
  const colecoes: { chave: Chave; temProxima: boolean; rotulo: string }[] = [
    { chave: "pagina", temProxima: dados.temProxima, rotulo: "Páginas de cobranças" },
    { chave: "paginaRecebimentos", temProxima: dados.temProximaRecebimentos, rotulo: "Páginas de recebimentos" },
    { chave: "paginaPagadores", temProxima: dados.temProximaPagadores, rotulo: "Páginas de pagadores" },
    { chave: "paginaPropostas", temProxima: dados.temProximaPropostas, rotulo: "Páginas de propostas" },
  ];
  return <section className="max-w-5xl space-y-4"><VoltarPara href="/financeiro" /><EntradaFinanceiraHistorica linhaId={dados.linha.id} temMapa={!!dados.linha.mapa} moeda={dados.linha.mapa?.moeda ?? ""} paises={paises.ok && paises.dado ? paises.dado : []} propostas={entradas.ok && entradas.dado ? entradas.dado : []} /><ConferenciaFinanceiraMigracao dados={dados} preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null} />{colecoes.map(({ chave, temProxima, rotulo }) => <Paginacao key={chave} pagina={paginas[chave]} temProxima={temProxima} href={href(chave)} rotulo={rotulo} />)}</section>;
}
