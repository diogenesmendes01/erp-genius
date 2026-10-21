"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatarMoeda } from "@/lib/dinheiro";
import { FORMA_PAGAMENTO_LABEL, STATUS_PAGAMENTO_INFORMADO_LABEL, rotular } from "@/lib/labels";
import { conferirPagamento } from "@/server/financeiro/acoes";
import type { listarInformesPagamento } from "@/server/financeiro/consultas";
import { formatarDiaCivilGravado, formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import Link from "next/link";
import { PaginacaoFila } from "@/components/PaginacaoFila";
import { hrefLista } from "@/lib/pagina-url";

function textoInstanteOperacional(iso: string, preferenciaFusoExibicao: string | null) {
  const exibicao = formatarInstanteExibicao(iso, preferenciaFusoExibicao, "UTC");
  return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
}

/** Navegação da fila de informes a conferir (aba do /financeiro): cursores do trecho, rota e a volta ao início. */
export type FilaInformes = { anterior: string | null; proxima: string | null; rota: string; inicioDaFila: string | null };

export function InformesPagamento({ informes, fila = null, preferenciaFusoExibicao = null, fusoEscola }: {
  informes: Awaited<ReturnType<typeof listarInformesPagamento>>;
  /** Só na fila do /financeiro (por cursor nos dois sentidos); a ficha do aluno mostra o histórico dele sem trechos. */
  fila?: FilaInformes | null;
  preferenciaFusoExibicao?: string | null;
  /** A data do pagamento informada é data civil gravada (meio-dia da escola): sai no dia da escola, sem fuso pessoal. */
  fusoEscola: string;
}) {
  const router = useRouter();
  // Idempotente por natureza (#166): a conferência trava o informe e confere a versão; repetida pelo mesmo
  // conferente com a mesma decisão, devolve ok sem nova baixa (conferirPagamento; politica.int.test.ts).
  const acao = useAcaoCliente({ idempotente: true });
  // O erro aparece no informe cujo botão disparou a conferência.
  const [alvo, setAlvo] = useState<string | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  async function decidir(id: string, versao: number, confirmar: boolean) {
    setAlvo(id);
    const d = await acao.executar(() => conferirPagamento(id, { versao, confirmar, motivo: motivos[id] }));
    if (d?.tipo === "ok") router.refresh();
  }
  return <section className="space-y-3">
    <h2 className="text-lg font-medium">Pagamentos informados</h2>
    <p className="text-sm text-gray-600">Informes a conferir preservam o saldo até a confirmação de outra pessoa do Financeiro.</p>
    {!informes.length && (fila?.inicioDaFila
      ? <EstadoVazio acao={<Link className="text-brand-700 underline" href={fila.inicioDaFila}>Ir para o início da fila</Link>}>Nenhum informe a partir deste ponto da fila: os seguintes já foram conferidos ou o link ficou antigo.</EstadoVazio>
      : <EstadoVazio>Nenhum informe neste atendimento.</EstadoVazio>)}
    {informes.map((i) => <article key={i.id} className="space-y-2 rounded-md border p-3 text-sm">
      <p><strong>{i.aluno}</strong> · {i.cobranca} · {formatarMoeda(i.valor, i.moeda)} · {formatarDiaCivilGravado(i.dataPagamento, fusoEscola)}</p>
      <p>{rotular(STATUS_PAGAMENTO_INFORMADO_LABEL, i.status)} · {rotular(FORMA_PAGAMENTO_LABEL, i.forma)}</p>
      {i.status === "A_CONFERIR" && i.suspenderLembretesAte && <p className="text-xs text-gray-600">Prazo de conferência: {textoInstanteOperacional(i.suspenderLembretesAte, preferenciaFusoExibicao)}</p>}
      {i.comentario && <p>{i.comentario}</p>}
      {i.comprovanteUrl && <a className="text-brand-700 underline" href={i.comprovanteUrl} target="_blank" rel="noreferrer">{i.comprovanteNome ?? "Abrir comprovante"}</a>}
      {i.motivoConferencia && <p>Motivo: {i.motivoConferencia}</p>}
      {i.podeConferir && <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Motivo da decisão" className="rounded border px-2 py-1" placeholder="Motivo (obrigatório para rejeitar)" value={motivos[i.id] ?? ""} onChange={(e) => setMotivos({ ...motivos, [i.id]: e.target.value })} />
        <button disabled={acao.ocupado} className={botaoClasses()} onClick={() => decidir(i.id, i.versao, true)}>Confirmar recebimento</button>
        <button disabled={acao.ocupado || !motivos[i.id]?.trim()} className={botaoClasses({ variante: "perigo" })} onClick={() => decidir(i.id, i.versao, false)}>Rejeitar</button>
      </div>}
      <FeedbackAcao erro={alvo === i.id ? acao.erro : null} />
    </article>)}
    {fila && <PaginacaoFila anterior={fila.anterior} proxima={fila.proxima} href={(cursor) => hrefLista(fila.rota, cursor)} rotulo="Navegação da fila de informes a conferir" />}
  </section>;
}
