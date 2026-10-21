"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { ACAO_AGENTE_IA_LABEL, ETAPA_LABEL, STATUS_ACAO_AGENTE_IA_LABEL } from "@/lib/labels";
import { ETAPAS_ARIA } from "@/server/aria/matriz";
import { ACOES_MATRIZ } from "@/server/aria/matriz";
import { aprovarAcaoAria, desfazerAcaoAria, rejeitarAcaoAria } from "@/server/aria/acoes";
import type { ItemHistoricoAria } from "@/server/aria/consultas";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";

type Props = {
  itens: ItemHistoricoAria[];
  proximo: string | null;
  podeDecidir: boolean;
  /** Fuso de exibição já resolvido pela página: o pessoal; sem ele, o da escola. */
  fuso: string;
  filtros: { busca: string; acao: string; etapa: string; resultado: string };
};

const RESULTADOS = [
  { valor: "", rotulo: "Todas" },
  { valor: "PENDENTES", rotulo: "Pendentes" },
  { valor: "EXECUTADAS", rotulo: "Executadas" },
  { valor: "REJEITADAS", rotulo: "Rejeitadas" },
  { valor: "DESFEITAS", rotulo: "Desfeitas" },
];
const CAMPO = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";

export function Historico({ itens, proximo, podeDecidir, fuso, filtros }: Props) {
  const router = useRouter();
  // Aprovar, rejeitar e desfazer são idempotentes por natureza (#166, 7º lote): o reenvio de quem já decidiu ou desfez
  // devolve ok sem efetivar a ação da Aria de novo (server/aria/historico.ts).
  const acao = useAcaoCliente({ idempotente: true });
  const [desfazendo, setDesfazendo] = useState<ItemHistoricoAria | null>(null);
  const quando = (iso: string) => formatarInstanteExibicao(iso, fuso, "UTC", "diaMesHora").texto;

  async function decidir(fn: () => ReturnType<typeof aprovarAcaoAria>, ok: string) {
    const d = await acao.executar(fn, ok);
    if (d?.tipo === "ok") router.refresh();
  }

  const botoes = (i: ItemHistoricoAria) => {
    const nome = `${ACAO_AGENTE_IA_LABEL[i.acao]} de ${i.contato}`;
    return (
      <div className="flex flex-wrap gap-2">
        {podeDecidir && i.status === "SUGERIDA" && (
          <>
            <Botao tamanho="sm" aria-label={`Aprovar ${nome}`} disabled={acao.ocupado} onClick={() => decidir(() => aprovarAcaoAria(i.id), "Ação aprovada.")}>Aprovar</Botao>
            <Botao tamanho="sm" variante="perigo" aria-label={`Rejeitar ${nome}`} disabled={acao.ocupado} onClick={() => decidir(() => rejeitarAcaoAria(i.id), "Ação rejeitada.")}>Rejeitar</Botao>
          </>
        )}
        {i.podeDesfazer && (
          <Botao tamanho="sm" variante="secundario" aria-label={`Desfazer ${nome}`} onClick={() => setDesfazendo(i)}>Desfazer</Botao>
        )}
        {i.motivoIrreversivel && <span className="text-xs text-gray-600">Não dá para desfazer: {i.motivoIrreversivel}</span>}
      </div>
    );
  };

  return (
    <section aria-labelledby="titulo-historico" className="space-y-4">
      <h2 id="titulo-historico" className="text-lg font-semibold text-gray-900">O que a Aria fez</h2>

      <form method="get" action="/aria" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="aba" value="historico" />
        <label className="grid gap-1 text-sm font-medium text-gray-800">Contato ou telefone
          <input name="busca" defaultValue={filtros.busca} className={CAMPO} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-gray-800">Ação
          <select name="acao" defaultValue={filtros.acao} className={CAMPO}>
            <option value="">Todas</option>
            {ACOES_MATRIZ.map((a) => <option key={a} value={a}>{ACAO_AGENTE_IA_LABEL[a]}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-gray-800">Etapa
          <select name="etapa" defaultValue={filtros.etapa} className={CAMPO}>
            <option value="">Todas</option>
            {ETAPAS_ARIA.map((e) => <option key={e} value={e}>{ETAPA_LABEL[e]}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-gray-800">Resultado
          <select name="resultado" defaultValue={filtros.resultado} className={CAMPO}>
            {RESULTADOS.map((r) => <option key={r.valor} value={r.valor}>{r.rotulo}</option>)}
          </select>
        </label>
        <div><Botao type="submit" variante="secundario">Filtrar</Botao></div>
      </form>

      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />

      {itens.length === 0 ? (
        <EstadoVazio bloco>Nenhuma ação da Aria com esses filtros.</EstadoVazio>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border-soft md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-left text-gray-800">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Quando</th>
                  <th scope="col" className="px-3 py-2 font-medium">Ação</th>
                  <th scope="col" className="px-3 py-2 font-medium">Contato</th>
                  <th scope="col" className="px-3 py-2 font-medium">Etapa</th>
                  <th scope="col" className="px-3 py-2 font-medium">Confiança</th>
                  <th scope="col" className="px-3 py-2 font-medium">Resultado</th>
                  <th scope="col" className="px-3 py-2 font-medium">Decidido por</th>
                  <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => (
                  <tr key={i.id} className="border-t border-border-soft align-top">
                    <td className="whitespace-nowrap px-3 py-2">{quando(i.quando)}</td>
                    <td className="px-3 py-2">{ACAO_AGENTE_IA_LABEL[i.acao]}</td>
                    <td className="px-3 py-2">{i.contato}</td>
                    <td className="px-3 py-2">{i.etapa ? ETAPA_LABEL[i.etapa] : "—"}</td>
                    <td className="px-3 py-2">{i.confianca}%</td>
                    <td className="px-3 py-2">{STATUS_ACAO_AGENTE_IA_LABEL[i.status]}</td>
                    <td className="px-3 py-2">{i.decididaPor ?? "—"}</td>
                    <td className="px-3 py-2">{botoes(i)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {itens.map((i) => (
              <li key={i.id} className="rounded-lg border border-border-soft p-3 text-sm">
                <p className="font-medium text-gray-900">{ACAO_AGENTE_IA_LABEL[i.acao]} · {i.contato}</p>
                <p className="text-gray-700">{quando(i.quando)} · {i.etapa ? ETAPA_LABEL[i.etapa] : "sem etapa"} · confiança {i.confianca}%</p>
                <p className="text-gray-700">{STATUS_ACAO_AGENTE_IA_LABEL[i.status]}{i.decididaPor ? ` por ${i.decididaPor}` : ""}</p>
                <div className="mt-2">{botoes(i)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      {proximo && (
        <Link
          className="inline-block text-sm text-brand-700 underline"
          href={`/aria?${new URLSearchParams({ aba: "historico", ...Object.fromEntries(Object.entries(filtros).filter(([, v]) => v)), cursor: proximo }).toString()}`}
        >
          Ver ações mais antigas
        </Link>
      )}

      {desfazendo && (
        <ConfirmarAcao
          titulo={`Desfazer ${ACAO_AGENTE_IA_LABEL[desfazendo.acao].toLowerCase()} de ${desfazendo.contato}?`}
          confirmacao="o desfazer"
          idempotente
          acao={() => desfazerAcaoAria(desfazendo.id)}
          aoConcluir={() => { setDesfazendo(null); acao.setSucesso("Ação desfeita."); router.refresh(); }}
          aoCancelar={() => setDesfazendo(null)}
        >
          <p>O CRM volta ao estado anterior à ação da Aria. Se uma pessoa mexeu depois, nada é desfeito.</p>
        </ConfirmarAcao>
      )}
    </section>
  );
}
