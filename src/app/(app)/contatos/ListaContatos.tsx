"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Botao, botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Paginacao } from "@/components/Paginacao";
import { ETAPA_LABEL, ORIGEM_CANAL_LABEL } from "@/lib/labels";
import { hrefLista } from "@/lib/pagina-url";
import type { FiltrosContatos, LinhaContato } from "@/server/crm/contatos";
import type { ParDuplicado, PessoaMesclavel } from "@/server/crm/ficha-dados";
import { paramsDaLista } from "./params-lista";
import { ImportarContatos } from "./ImportarContatos";
import { MesclarContatos } from "./MesclarContatos";

const CONTROLE = "rounded-md border border-border-soft bg-surface-raised px-2 text-sm min-h-11 sm:min-h-9";
const CAIXA = "flex h-11 w-11 shrink-0 items-center justify-center";

type Props = {
  itens: LinhaContato[];
  total: number;
  possuiMais: boolean;
  filtros: FiltrosContatos;
  abertoId: string;
  tags: { id: string; nome: string }[];
  /** Vendedores para o filtro de responsável e a importação; vazio fora do comercial. */
  vendedores: { id: string; nome: string }[];
  /** Filtros de funil (responsável, etapa) só existem para quem é do comercial. */
  comercial: boolean;
  podeImportar: boolean;
  podeMesclar: boolean;
  podeExportar: boolean;
  pares: ParDuplicado[];
  /** Dados de mesclagem das pessoas da página (vazio sem a capacidade). */
  mesclaveis: Record<string, PessoaMesclavel>;
  filtrando: boolean;
};

export function ListaContatos({ itens, total, possuiMais, filtros, abertoId, tags, vendedores, comercial, podeImportar, podeMesclar, podeExportar, pares, mesclaveis, filtrando }: Props) {
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const alternar = (id: string) => setSelecionados((atual) => (atual.includes(id) ? atual.filter((s) => s !== id) : [...atual, id]));
  const base = paramsDaLista(filtros);
  const marcadas = itens.filter((l) => selecionados.includes(l.id));
  const [a, b] = marcadas.map((l) => mesclaveis[l.id]);
  const selecionado = podeMesclar && marcadas.length === 2 && marcadas.every((l) => l.tipo === "pessoa") && a && b ? { a, b } : null;
  const exportacao = hrefLista("/api/exportacoes/contatos", base);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {podeImportar && <ImportarContatos vendedores={vendedores} />}
        {podeExportar && <a href={exportacao} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Exportar</a>}
      </div>

      <form method="get" action="/contatos" className="flex flex-wrap items-end gap-3" aria-label="Filtros dos contatos">
        <label className="grid gap-1 text-sm">
          Busca
          <input name="busca" defaultValue={filtros.busca} maxLength={200} placeholder="Nome, telefone ou código" className={CONTROLE} />
        </label>
        <label className="grid gap-1 text-sm">
          Tipo
          <select name="tipo" defaultValue={filtros.tipo} className={CONTROLE}>
            <option value="todos">Todos</option>
            <option value="pessoas">Pessoas</option>
            <option value="empresas">Empresas</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Tag
          <select name="tagId" defaultValue={filtros.tagId} className={CONTROLE}>
            <option value="">Todas</option>
            {tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Origem
          <select name="origem" defaultValue={filtros.origem} className={CONTROLE}>
            <option value="">Todas</option>
            {Object.entries(ORIGEM_CANAL_LABEL).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </label>
        {comercial && (
          <>
            <label className="grid gap-1 text-sm">
              Responsável
              <select name="donoId" defaultValue={filtros.donoId} className={CONTROLE}>
                <option value="">Todos</option>
                {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Etapa
              <select name="etapa" defaultValue={filtros.etapa} className={CONTROLE}>
                <option value="">Todas</option>
                {Object.entries(ETAPA_LABEL).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
              </select>
            </label>
          </>
        )}
        <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Filtrar</button>
      </form>

      {podeMesclar && <MesclarContatos pares={pares} selecionado={selecionado} />}

      {selecionados.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm" role="status">
          <span>{selecionados.length === 1 ? "1 contato selecionado" : `${selecionados.length} contatos selecionados`}</span>
          <Botao variante="fantasma" tamanho="md" onClick={() => setSelecionados([])}>Limpar seleção</Botao>
        </div>
      )}

      {itens.length === 0 ? (
        <EstadoVazio bloco acao={filtrando ? <Link href="/contatos" className={botaoClasses({ variante: "secundario", tamanho: "md" })}>Limpar filtros</Link> : undefined}>
          {filtrando ? "Nenhum contato com esses filtros." : "Nenhum contato na sua carteira."}
        </EstadoVazio>
      ) : (
        <>
          <p className="text-xs text-gray-600">{total === 1 ? "1 contato." : `${total} contatos.`}</p>
          <ul className="divide-y divide-border-soft rounded-lg border border-border-soft">
            {itens.map((l) => {
              const empresa = l.tipo === "empresa";
              const corpo = (
                <>
                  <Avatar nome={l.nome} tamanho={40} quadrado={empresa} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{l.nome}</span>
                    <span className="block truncate text-sm text-gray-600">
                      {[empresa ? "Empresa" : null, l.subtitulo, l.cidade, l.telefone].filter(Boolean).join(" · ") || "Sem dados de contato"}
                    </span>
                    {l.tags.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {l.tags.map((t) => <span key={t.id} className="rounded-full bg-brand-bg px-2 py-0.5 text-xs text-brand-800">{t.nome}</span>)}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 self-start text-right text-xs text-gray-600">
                    {l.optOut && <span className="block text-red-700">Opt-out</span>}
                    {l.oportunidade && <span className="block">{ETAPA_LABEL[l.oportunidade.etapa]}</span>}
                    {l.oportunidade?.dono && <span className="block">{l.oportunidade.dono}</span>}
                  </span>
                </>
              );
              const classe = "flex min-h-[76px] min-w-0 flex-1 items-center gap-3 rounded-item p-3 text-left " + (l.id === abertoId ? "bg-brand-bg text-brand-800" : "hover:bg-highlight");
              return (
                <li key={empresa ? `e:${l.id}` : `p:${l.id}`} className="flex items-center pl-1">
                  <label className={CAIXA}>
                    <input type="checkbox" aria-label={`Selecionar ${l.nome}`} checked={selecionados.includes(l.id)} onChange={() => alternar(l.id)} className="h-4 w-4" />
                  </label>
                  {empresa ? (
                    <div className={classe}>{corpo}</div>
                  ) : (
                    <Link href={hrefLista("/contatos", { ...base, c: l.id })} aria-current={l.id === abertoId ? "true" : undefined} className={classe}>
                      {corpo}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          <Paginacao pagina={filtros.pagina} temProxima={possuiMais} href={(p) => hrefLista("/contatos", { ...base, c: abertoId, pagina: p })} rotulo="Páginas de contatos" />
        </>
      )}
    </div>
  );
}
