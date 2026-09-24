"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { EtapaLead, Segmento, Temperatura } from "@prisma/client";
import {
  ETAPA_LABEL,
  SEGMENTO_LABEL,
  TEMPERATURA_LABEL,
  TEMPERATURA_CLS,
} from "@/lib/labels";
import {
  LEADS_POR_PAGINA,
  camposDosFiltrosLeads,
  filtrosLeadsParaQuery,
  hrefDosCamposLeads,
  sincronizarCamposLeads,
  temFiltroLeads,
  type CamposLeads,
  type FiltrosLeads,
} from "@/server/comercial/filtros";
import { criarEspera } from "@/lib/espera";
import { LeadFormulario } from "./LeadFormulario";

export interface LeadRow {
  id: string;
  codigo: string | null;
  nome: string;
  telefoneE164: string | null;
  segmento: Segmento;
  temperatura: Temperatura;
  etapa: EtapaLead;
  b2b: boolean;
  pais: { nome: string } | null;
  vendedor: { nome: string } | null;
}

const selCls =
  "rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500";

/** Link da mesma lista com os filtros atuais e outra página. */
const hrefPagina = (f: FiltrosLeads, pagina: number) => {
  const q = filtrosLeadsParaQuery({ ...f, pagina });
  return q ? `/leads?${q}` : "/leads";
};

// Lista de leads (E4), no mesmo desenho da de alunos: filtros na URL, aplicados no servidor, com
// busca e página. Navegação dentro de uma transição (botão "Buscando…", tabela aria-busy); trocar um
// filtro volta à página 1; os selects enviam após uma pausa curta (setas do teclado não criam uma
// navegação por tecla).
export function LeadsLista({
  leads,
  total,
  totalBase,
  filtros,
  donos,
  paises,
  vendedores,
  podeAtribuir,
}: {
  leads: LeadRow[];
  /** Leads que atendem aos filtros (todas as páginas). */
  total: number;
  /** Leads na carteira do usuário, sem filtro — distingue "nenhum lead" de "nenhum resultado". */
  totalBase: number;
  filtros: FiltrosLeads;
  /** Opções do filtro por dono (vazio = o filtro não aparece). */
  donos: { id: string; nome: string }[];
  paises: { id: string; nome: string }[];
  vendedores: { id: string; nome: string }[];
  podeAtribuir: boolean;
}) {
  const [novo, setNovo] = useState(false);
  const filtrando = temFiltroLeads(filtros);
  const inicio = total ? (filtros.pagina - 1) * LEADS_POR_PAGINA + 1 : 0;
  const fim = (filtros.pagina - 1) * LEADS_POR_PAGINA + leads.length;
  const temProxima = fim < total;
  const router = useRouter();
  const [buscando, iniciar] = useTransition();
  // Campos controlados, sem recriar o formulário (o foco não se perde): quando a URL muda, só os
  // campos cujo filtro mudou são atualizados. A espera pendente dos selects é cancelada a cada mudança.
  const [campos, setCampos] = useState<CamposLeads>(() => camposDosFiltrosLeads(filtros));
  const anteriores = useRef(filtros);
  const [espera] = useState(() => criarEspera(400));
  const chaveFiltros = filtrosLeadsParaQuery(filtros);
  useEffect(() => {
    espera.cancelar();
    setCampos((atuais) => sincronizarCamposLeads(atuais, anteriores.current, filtros));
    anteriores.current = filtros;
    // chaveFiltros representa `filtros` por valor (o objeto muda de identidade a cada render do servidor).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveFiltros, espera]);
  useEffect(() => () => espera.cancelar(), [espera]);

  const navegar = (href: string) => iniciar(() => router.push(href));
  const aplicar = (c: CamposLeads) => { espera.cancelar(); navegar(hrefDosCamposLeads(c)); };
  const mudarSelect = (campo: Exclude<keyof CamposLeads, "busca">) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const novos = { ...campos, [campo]: e.target.value };
    setCampos(novos);
    espera.agendar(() => aplicar(novos));
  };
  /** Link real (abre em nova aba, copia) que, no clique simples, navega dentro da transição. */
  const aoClicar = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    espera.cancelar();
    navegar(href);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-medium">Leads</h1>
        {!novo && (
          <button
            onClick={() => setNovo(true)}
            className="flex items-center gap-1.5 rounded-md bg-brand-solid px-3 py-2 text-sm font-medium text-white hover:brightness-95"
          >
            <IconPlus className="h-4 w-4" /> Novo lead
          </button>
        )}
      </div>

      {novo && (
        <div className="mb-6">
          <LeadFormulario
            paises={paises}
            vendedores={vendedores}
            podeAtribuir={podeAtribuir}
            onClose={() => setNovo(false)}
          />
        </div>
      )}

      <form
        action="/leads"
        onSubmit={(e) => { e.preventDefault(); aplicar(campos); }}
        className="mb-3 flex flex-wrap items-center gap-2"
        role="search"
        aria-label="Filtrar leads"
      >
        <input
          name="busca"
          value={campos.busca}
          onChange={(e) => setCampos({ ...campos, busca: e.target.value })}
          maxLength={100}
          aria-label="Buscar lead por nome, código ou telefone"
          placeholder="Buscar por nome, código ou telefone…"
          className={selCls + " w-64 px-3"}
        />
        <select name="tipo" value={campos.tipo} onChange={mudarSelect("tipo")} aria-label="Filtrar por tipo de lead" className={selCls}>
          <option value="">PF e B2B</option>
          <option value="pf">Pessoa Física</option>
          <option value="b2b">Empresa (B2B)</option>
        </select>
        <select name="etapa" value={campos.etapa} onChange={mudarSelect("etapa")} aria-label="Filtrar por etapa" className={selCls}>
          <option value="">Todas as etapas</option>
          {Object.values(EtapaLead).map((e) => (
            <option key={e} value={e}>
              {ETAPA_LABEL[e]}
            </option>
          ))}
        </select>
        <select name="segmento" value={campos.segmento} onChange={mudarSelect("segmento")} aria-label="Filtrar por segmento" className={selCls}>
          <option value="">Todos os segmentos</option>
          {Object.values(Segmento).map((s) => (
            <option key={s} value={s}>
              {SEGMENTO_LABEL[s]}
            </option>
          ))}
        </select>
        <select name="temperatura" value={campos.temperatura} onChange={mudarSelect("temperatura")} aria-label="Filtrar por temperatura" className={selCls}>
          <option value="">Toda temperatura</option>
          {Object.values(Temperatura).map((t) => (
            <option key={t} value={t}>
              {TEMPERATURA_LABEL[t]}
            </option>
          ))}
        </select>
        {donos.length > 0 && (
          <select name="dono" value={campos.dono} onChange={mudarSelect("dono")} aria-label="Filtrar por dono" className={selCls}>
            <option value="">Todos os donos</option>
            {donos.map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </select>
        )}
        <button type="submit" disabled={buscando} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          {buscando ? "Buscando…" : "Buscar"}
        </button>
        {filtrando && <Link href="/leads" onClick={aoClicar("/leads")} className="text-sm text-brand-700 hover:underline">Limpar filtros</Link>}
      </form>

      <p className="mb-2 text-xs text-gray-500" aria-live="polite">
        {buscando ? "Buscando…" : total === 0 || leads.length === 0 ? "Nenhum lead" : filtrando
          ? `${inicio}–${fim} de ${total} ${total === 1 ? "lead encontrado" : "leads encontrados"} (de ${totalBase} no total)`
          : `${inicio}–${fim} de ${total} ${total === 1 ? "lead" : "leads"}`}
      </p>

      <div aria-busy={buscando} className={"overflow-x-auto rounded-lg border border-gray-200 transition-opacity " + (buscando ? "opacity-60" : "")}>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Lead</th>
              <th className="px-4 py-2 font-medium">Segmento</th>
              <th className="px-4 py-2 font-medium">Etapa</th>
              <th className="px-4 py-2 font-medium">Temp.</th>
              <th className="px-4 py-2 font-medium">País</th>
              <th className="px-4 py-2 font-medium">Dono</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                  {/* Estado vazio duplo: carteira vazia × filtro sem resultado (este oferece a saída). */}
                  {totalBase === 0 ? "Nenhum lead na sua carteira." : filtrando ? (
                    <>Nenhum lead com esses filtros. <Link href="/leads" onClick={aoClicar("/leads")} className="text-brand-700 hover:underline">Limpar filtros</Link></>
                  ) : (
                    <>Nenhum lead nesta página. <Link href="/leads" onClick={aoClicar("/leads")} className="text-brand-700 hover:underline">Ir para a primeira página</Link></>
                  )}
                </td>
              </tr>
            ) : (
              leads.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="font-medium text-brand-700 hover:underline">
                      {l.nome}
                    </Link>
                    <div className="text-xs text-gray-400">
                      {l.codigo}
                      {l.b2b && " · B2B"}
                      {l.telefoneE164 && ` · ${l.telefoneE164}`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{SEGMENTO_LABEL[l.segmento]}</td>
                  <td className="px-4 py-3 text-gray-600">{ETAPA_LABEL[l.etapa]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " + TEMPERATURA_CLS[l.temperatura]
                      }
                    >
                      {TEMPERATURA_LABEL[l.temperatura]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{l.pais?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{l.vendedor?.nome ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(filtros.pagina > 1 || temProxima) && (
        <nav aria-label="Páginas de leads" className="mt-3 flex items-center gap-4 text-sm">
          {filtros.pagina > 1 && <Link href={hrefPagina(filtros, filtros.pagina - 1)} onClick={aoClicar(hrefPagina(filtros, filtros.pagina - 1))} className="text-brand-700 hover:underline">← Anterior</Link>}
          <span className="text-gray-500">Página {filtros.pagina}</span>
          {temProxima && <Link href={hrefPagina(filtros, filtros.pagina + 1)} onClick={aoClicar(hrefPagina(filtros, filtros.pagina + 1))} className="text-brand-700 hover:underline">Próxima →</Link>}
        </nav>
      )}
    </div>
  );
}
