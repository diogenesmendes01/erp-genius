"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EtapaLead } from "@prisma/client";
import { Botao, botaoClasses } from "@/components/Botao";
import { Chip } from "@/components/Chip";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { ETAPA_LABEL, ORIGEM_CANAL_LABEL, TEMPERATURA_LABEL } from "@/lib/labels";
import { moverEtapaEmLote } from "@/server/crm/oportunidades";
import type { CapacidadeCrm } from "@/server/crm/permissoes";
import type { ColunaFunil, FiltrosFunil } from "@/server/crm/funil";
import type { DetalheOportunidade, ItemHistorico } from "@/server/crm/historico";
import { FUSO_PADRAO, type AcaoDoCartao } from "./CartaoOportunidade";
import { ListaFunil } from "./ListaFunil";
import { hrefSalvo } from "./href-salvo";
import { ModalPerda } from "./ModalPerda";
import { NovaOportunidade } from "./NovaOportunidade";
import { PainelOportunidade } from "./PainelOportunidade";
import { QuadroFunil } from "./QuadroFunil";

type Props = {
  colunas: ColunaFunil[];
  modo: "quadro" | "lista";
  filtros: FiltrosFunil;
  dirOrdem: "asc" | "desc";
  salvos: { id: string; nome: string; filtros: Record<string, string> }[];
  aberta: { oportunidade: DetalheOportunidade; historico: ItemHistorico[] } | null;
  oportunidadeNaoEncontrada: boolean;
  capacidades: CapacidadeCrm[];
  podeAtribuir: boolean;
  vendedores: { id: string; nome: string }[];
  paises: { id: string; nome: string }[];
  fuso?: string;
  /** Fuso pessoal de exibição dos instantes do painel (criação, histórico, experimental); sem ele, o da escola. */
  preferenciaFusoExibicao?: string | null;
  /** Estado vazio já resolvido no servidor (carteira vazia × filtro sem resultado); null = há oportunidades. */
  vazio: ReactNode;
};

const CAMPO = "rounded-md border border-gray-300 bg-surface px-2 py-1.5 text-sm max-sm:min-h-11";

export function FunilCliente({
  colunas, modo, filtros, dirOrdem, salvos, aberta, oportunidadeNaoEncontrada, capacidades, podeAtribuir, vendedores, paises, fuso = FUSO_PADRAO, preferenciaFusoExibicao = null, vazio,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const atuais = useSearchParams();
  const acao = useAcaoCliente({ idempotente: false });
  const [novo, setNovo] = useState(false);
  const [perda, setPerda] = useState<{ id: string; nome: string } | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [etapaLote, setEtapaLote] = useState<EtapaLead | "">("");

  const podeMover = capacidades.includes("funil.mover");
  const nomeDe = (id: string) => colunas.flatMap((c) => c.cartoes).find((c) => c.id === id)?.nome ?? "";

  const comParametros = (alterar: (q: URLSearchParams) => void) => {
    const q = new URLSearchParams(atuais?.toString() ?? "");
    alterar(q);
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  };
  const abrir = (id: string) => router.push(comParametros((q) => q.set("o", id)), { scroll: false });
  const fechar = () => router.push(comParametros((q) => q.delete("o")), { scroll: false });
  const hrefModo = (m: "quadro" | "lista") => comParametros((q) => (m === "lista" ? q.set("modo", "lista") : q.delete("modo")));

  function pedirAcao(id: string, a: AcaoDoCartao) {
    if (a === "marcarPerdido") return setPerda({ id, nome: nomeDe(id) });
    if (a === "prepararContratacao") return router.push(`/oportunidades/${id}/contratacao`);
    return abrir(id);
  }

  async function moverLote() {
    if (!etapaLote) return;
    const d = await acao.executar(() => moverEtapaEmLote(selecionados, etapaLote), "Etapa atualizada.");
    if (d?.tipo === "ok") {
      setSelecionados([]);
      router.refresh();
    }
  }

  const ordemAtual = filtros.ordem === "recentes" ? null : { campo: filtros.ordem, dir: dirOrdem };
  const parametrosLista: Record<string, string> = Object.fromEntries(
    Object.entries({ ...filtros, modo: "lista" }).filter(([k, v]) => v && !(k === "ordem") && !(k === "perdidosDias" && v === "todos")),
  ) as Record<string, string>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-medium">Funil</h1>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Visualização" className="flex gap-1">
            <Link href={hrefModo("quadro")} aria-current={modo === "quadro" ? "page" : undefined} className={botaoClasses({ variante: modo === "quadro" ? "primario" : "secundario", tamanho: "md" })}>Quadro</Link>
            <Link href={hrefModo("lista")} aria-current={modo === "lista" ? "page" : undefined} className={botaoClasses({ variante: modo === "lista" ? "primario" : "secundario", tamanho: "md" })}>Lista</Link>
          </nav>
          {podeMover && <Botao variante="primario" tamanho="md" onClick={() => setNovo(true)}>Nova oportunidade</Botao>}
        </div>
      </div>

      <form method="get" action="/funil" role="search" aria-label="Filtros do funil" className="flex flex-wrap items-end gap-2">
        {modo === "lista" && <input type="hidden" name="modo" value="lista" />}
        <label className="flex flex-col gap-1 text-xs text-gray-600">Busca
          <input name="busca" defaultValue={filtros.busca} maxLength={200} className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">Tipo
          <select name="tipo" defaultValue={filtros.tipo} className={CAMPO}>
            <option value="">Todos</option>
            <option value="pf">Pessoa</option>
            <option value="b2b">Empresa</option>
          </select>
        </label>
        {podeAtribuir && (
          <label className="flex flex-col gap-1 text-xs text-gray-600">Dono
            <select name="donoId" defaultValue={filtros.donoId} className={CAMPO}>
              <option value="">Todos</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-gray-600">Temperatura
          <select name="temperatura" defaultValue={filtros.temperatura} className={CAMPO}>
            <option value="">Todas</option>
            {Object.entries(TEMPERATURA_LABEL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">Origem
          <select name="origem" defaultValue={filtros.origem} className={CAMPO}>
            <option value="">Todas</option>
            {Object.entries(ORIGEM_CANAL_LABEL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">Perdidos
          <select name="perdidosDias" defaultValue={filtros.perdidosDias} className={CAMPO}>
            <option value="todos">Todos</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">Ordem
          <select name="ordem" defaultValue={filtros.ordem} className={CAMPO}>
            <option value="recentes">Mais recentes</option>
            <option value="valor">Maior valor</option>
            <option value="proxima">Ação seguinte</option>
            <option value="tempo">Tempo na etapa</option>
          </select>
        </label>
        <Botao type="submit" variante="secundario" tamanho="md">Filtrar</Botao>
        <Link href={modo === "lista" ? "/funil?modo=lista" : "/funil"} className={botaoClasses({ variante: "fantasma", tamanho: "md" })}>Limpar</Link>
      </form>

      {salvos.length > 0 && (
        <nav aria-label="Visualizações salvas" className="flex flex-wrap gap-2">
          {salvos.map((s) => (
            <Chip key={s.id} selecionado={false} onClick={() => router.push(hrefSalvo(s.filtros))}>{s.nome}</Chip>
          ))}
        </nav>
      )}

      {oportunidadeNaoEncontrada && <p role="alert" className="rounded-md border border-border-soft p-3 text-sm">Oportunidade fora da sua carteira.</p>}
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />

      {vazio ?? (modo === "lista" ? (
        <div className="space-y-3">
          {podeMover && selecionados.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">{selecionados.length} selecionada(s)</span>
              <select aria-label="Mover para a etapa" value={etapaLote} onChange={(e) => setEtapaLote(e.target.value as EtapaLead | "")} className={CAMPO}>
                <option value="">Mover para…</option>
                {colunas.map((c) => <option key={c.etapa} value={c.etapa}>{ETAPA_LABEL[c.etapa]}</option>)}
              </select>
              <Botao variante="secundario" tamanho="md" disabled={!etapaLote || acao.ocupado} onClick={moverLote}>Mover selecionadas</Botao>
            </div>
          )}
          <ListaFunil colunas={colunas} aoAbrir={abrir} selecionados={selecionados} aoSelecionar={setSelecionados} ordem={ordemAtual} parametros={parametrosLista} fuso={fuso} />
        </div>
      ) : (
        <QuadroFunil colunas={colunas} podeMover={podeMover} aoAbrir={abrir} aoPedirAcao={pedirAcao} fuso={fuso} />
      ))}

      {aberta && (
        <PainelOportunidade
          key={aberta.oportunidade.id}
          oportunidade={aberta.oportunidade}
          historico={aberta.historico}
          capacidades={capacidades}
          vendedores={vendedores}
          paises={paises}
          aoFechar={fechar}
          fuso={fuso}
          preferenciaFusoExibicao={preferenciaFusoExibicao}
        />
      )}
      {novo && <NovaOportunidade podeAtribuir={podeAtribuir} vendedores={vendedores} paises={paises} aoFechar={() => setNovo(false)} />}
      {perda && <ModalPerda oportunidadeId={perda.id} nome={perda.nome} aoFechar={() => setPerda(null)} />}
    </div>
  );
}
