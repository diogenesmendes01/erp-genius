"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { botaoClasses } from "@/components/Botao";
import { Drawer } from "@/components/Drawer";
import { EstadoVazio } from "@/components/EstadoVazio";
import { ETAPA_LABEL, rotular } from "@/lib/labels";
import type { ItemDetalhe } from "@/server/relatorios/detalhe";
import { fmtDias, fmtInteiro, fmtMoedas, hrefRelatorio, type ParamsRelatorio } from "./formato";

/**
 * Oportunidades por trás de um número. Celular: folha inteira (fullsheet); a partir de md, painel lateral (Drawer:
 * diálogo com foco preso, Escape e fundo fecham). A lista chega pronta do servidor; fechar volta à URL sem `detalhe`.
 * Sem telefone, e-mail nem documento.
 */
export function PainelDetalhe({ titulo, params, resultado, erro, limite }: {
  titulo: string;
  params: ParamsRelatorio;
  resultado: { total: number; itens: ItemDetalhe[] } | null;
  erro: boolean;
  limite: number;
}) {
  const router = useRouter();
  const fechar = hrefRelatorio(params, { detalhe: null, busca: null });
  return (
    <Drawer id="painel-detalhe" open onClose={() => router.push(fechar)} title={titulo}>
      <div data-painel-detalhe="">
        <form method="get" action="/relatorios" role="search" aria-label="Buscar nas oportunidades" className="flex gap-2">
          {Object.entries(params).filter(([k]) => k !== "busca").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input type="search" name="busca" defaultValue={params.busca ?? ""} aria-label="Buscar por nome" placeholder="Buscar por nome" maxLength={100} className="min-h-11 flex-1 rounded-md border border-gray-300 px-2 text-sm md:min-h-0 md:py-1.5" />
          <button type="submit" className={botaoClasses({ variante: "secundario" })}>Buscar</button>
        </form>
        {erro || !resultado ? (
          <p role="alert" className="mt-3 rounded-md bg-red-100 p-3 text-sm text-red-700">Não foi possível carregar as oportunidades. Tente de novo.</p>
        ) : resultado.itens.length === 0 ? (
          <EstadoVazio className="mt-3">Nenhuma oportunidade aqui.</EstadoVazio>
        ) : (
          <>
            <p className="mt-3 text-xs text-gray-600">
              {resultado.total > resultado.itens.length
                ? `Mostrando ${fmtInteiro(resultado.itens.length)} de ${fmtInteiro(resultado.total)} (limite de ${limite}). Refine os filtros ou a busca.`
                : `${fmtInteiro(resultado.total)} ${resultado.total === 1 ? "oportunidade" : "oportunidades"}.`}
            </p>
            <ul className="mt-2 divide-y divide-border-soft rounded-lg border border-border-soft text-sm">
              {resultado.itens.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span>
                    <Link href={i.href} className="font-medium text-brand-700 hover:underline max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">{i.nome}</Link>
                    <span className="block text-xs text-gray-600">{rotular(ETAPA_LABEL, i.etapa)}{i.responsavel ? ` · ${i.responsavel}` : ""} · {fmtDias(i.diasDesdeCriacao)}</span>
                  </span>
                  <span className="text-xs">{i.valor == null || !i.moeda ? "sem valor" : fmtMoedas([{ moeda: i.moeda, valor: i.valor }])}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Drawer>
  );
}
