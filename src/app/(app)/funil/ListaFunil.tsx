"use client";

import { Avatar } from "@/components/Avatar";
import { BadgeEstado } from "@/components/BadgeEstado";
import { ColunaOrdenavel } from "@/components/ColunaOrdenavel";
import { ETAPA_LABEL } from "@/lib/labels";
import type { Ordenacao } from "@/lib/ordenacao";
import type { ColunaFunil } from "@/server/crm/funil";
import { FUSO_PADRAO, Temperatura, proximaAcaoDoCartao, textoDiasNaEtapa, valorComMoeda } from "./CartaoOportunidade";

type Props = {
  colunas: ColunaFunil[];
  aoAbrir: (id: string) => void;
  selecionados: string[];
  aoSelecionar: (ids: string[]) => void;
  ordem?: Ordenacao | null;
  parametros?: Record<string, string>;
  rota?: string;
  agora?: Date;
  fuso?: string;
};

const CAIXA = "flex h-11 w-11 items-center justify-center";

export function ListaFunil({ colunas, aoAbrir, selecionados, aoSelecionar, ordem = null, parametros = {}, rota = "/funil", agora, fuso = FUSO_PADRAO }: Props) {
  const referencia = agora ?? new Date();
  const cartoes = colunas.flatMap((c) => c.cartoes);
  const marcados = new Set(selecionados);
  const todos = cartoes.length > 0 && cartoes.every((c) => marcados.has(c.id));
  const alternar = (id: string) => aoSelecionar(marcados.has(id) ? selecionados.filter((s) => s !== id) : [...selecionados, id]);
  const ord = (campo: string, rotulo: string, direcaoInicial: "asc" | "desc") => (
    <ColunaOrdenavel campo={campo} rotulo={rotulo} ordenacao={ordem} rota={rota} parametros={parametros} direcaoInicial={direcaoInicial} />
  );
  const cab = "px-4 py-2 font-medium";
  return (
    <div className="overflow-x-auto rounded-lg border border-border-soft">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-muted text-left text-xs text-gray-600">
          <tr>
            <th scope="col" className="w-11 px-1 py-0">
              <label className={CAIXA}>
                <input
                  type="checkbox"
                  aria-label="Selecionar todas as oportunidades"
                  checked={todos}
                  onChange={() => aoSelecionar(todos ? [] : cartoes.map((c) => c.id))}
                  className="h-4 w-4"
                />
              </label>
            </th>
            <th scope="col" className={cab}>Oportunidade</th>
            <th scope="col" className={cab}>Etapa</th>
            <th scope="col" className={cab}>Responsável</th>
            <th scope="col" className={cab}>Temperatura</th>
            {ord("valor", "Valor", "desc")}
            {ord("proxima", "Ação seguinte", "asc")}
            {ord("tempo", "Tempo na etapa", "asc")}
          </tr>
        </thead>
        <tbody>
          {cartoes.map((c) => {
            const proxima = proximaAcaoDoCartao(c, referencia, fuso);
            return (
              <tr key={c.id} className="border-t border-border-soft transition-colors hover:bg-surface-muted">
                <td className="px-1 py-0">
                  <label className={CAIXA}>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${c.nome}`}
                      checked={marcados.has(c.id)}
                      onChange={() => alternar(c.id)}
                      className="h-4 w-4"
                    />
                  </label>
                </td>
                <td className="px-4 py-2">
                  <button type="button" onClick={() => aoAbrir(c.id)} className="flex items-center gap-2 text-left max-sm:min-h-11">
                    <Avatar nome={c.nome} tamanho={32} />
                    <span>
                      <span className="block font-medium">{c.nome}</span>
                      <span className="block font-mono text-xs tabular-nums text-gray-600">{c.codigo ? `#${c.codigo}` : "Sem código"}</span>
                    </span>
                  </button>
                </td>
                <td className="px-4 py-2"><BadgeEstado tom="brand" ponto>{ETAPA_LABEL[c.etapa]}</BadgeEstado></td>
                <td className="px-4 py-2">
                  {c.dono ? (
                    <div className="flex items-center gap-2"><Avatar nome={c.dono.nome} tamanho={32} /><span>{c.dono.nome}</span></div>
                  ) : "Sem responsável"}
                </td>
                <td className="px-4 py-2"><Temperatura temperatura={c.temperatura} /></td>
                <td className="px-4 py-2 font-mono tabular-nums">{c.valorPrevisto && c.moeda ? valorComMoeda(c.valorPrevisto, c.moeda) : "—"}</td>
                <td className={"px-4 py-2 " + (proxima?.vencida ? "text-red-700" : "")}>{proxima?.texto ?? "—"}</td>
                <td className="px-4 py-2">{textoDiasNaEtapa(c.etapaDesde, referencia, fuso)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
