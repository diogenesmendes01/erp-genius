import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarFilaContinuidadeMensal } from "@/server/matricula/continuidade-fila";
import { FilaContinuidadeMensal } from "./FilaContinuidadeMensal";
import { VoltarPara } from "@/components/VoltarPara";
import { PaginacaoFila } from "@/components/PaginacaoFila";
import { hrefLista, type ParametrosUrl } from "@/lib/pagina-url";
import { cursorDaLeitura, lerNavegacao } from "@/lib/cursor-fila";

export default async function FilaContinuidadeMensalPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const nav = lerNavegacao(await searchParams);
  const resultado = await consultarFilaContinuidadeMensal(nav);
  if (!resultado.ok || !resultado.dado) {
    return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  }

  const { itens, anterior, proxima } = resultado.dado;
  return <section className="space-y-4">
    <VoltarPara href="/financeiro" />
    <h1 className="text-2xl font-medium">Fila de continuidade mensal</h1>
    <p>Consulte as condições de cada matrícula antes de qualquer providência. Esta tela não emite cobranças nem atesta que o processamento recorrente esteja ativo.</p>
    <FilaContinuidadeMensal itens={itens} inicioDaFila={cursorDaLeitura(nav) !== null ? "/financeiro/continuidade" : null} />
    <PaginacaoFila anterior={anterior} proxima={proxima} href={(cursor) => hrefLista("/financeiro/continuidade", cursor)} rotulo="Navegação da fila de continuidade mensal" />
  </section>;
}
