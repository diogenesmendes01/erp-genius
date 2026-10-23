import Link from "next/link";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { listarFilaInformesPagamento } from "@/server/financeiro/consultas";
import { cursorDaLeitura, lerNavegacao, validarNavegacao } from "@/lib/cursor-fila";
import type { ParametrosUrl } from "@/lib/pagina-url";
import { InformesPagamento } from "../../InformesPagamento";
import { AcessoNegado } from "@/components/AcessoNegado";
import { contextoDaAba } from "../../contexto";

const ROTA = "/financeiro/informes";

// Aba "informes" do /financeiro (E8: uma rota por aba). Guard da própria aba ANTES das consultas — o
// layout só decide a barra; uma rota pedida direto por quem não enxerga a aba não consulta nada.
// Item 9 (docs/43 §6): os informes a conferir são uma fila de trabalho — lida por cursor nos dois sentidos
// (`depois`/`antes`), em trechos, em vez de todos de uma vez. O número da aba vem de um count no layout.
export default async function InformesFinanceiroPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  const ctx = await contextoDaAba("informes");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const nav = lerNavegacao(await searchParams);
  const validacao = validarNavegacao(nav);
  if (!validacao.ok) {
    return (
      <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {validacao.erro} <Link href={ROTA} className="underline">Ir para o início da fila</Link>
      </p>
    );
  }
  const [fila, preferencia, fusoEscola] = await Promise.all([listarFilaInformesPagamento(validacao.nav), consultarPreferenciaFusoEquipe(), fusoDaEscola()]);
  return (
    <InformesPagamento
      informes={fila.itens}
      fila={{ anterior: fila.anterior, proxima: fila.proxima, rota: ROTA, inicioDaFila: cursorDaLeitura(nav) !== null ? ROTA : null }}
      preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null}
      fusoEscola={fusoEscola}
    />
  );
}
