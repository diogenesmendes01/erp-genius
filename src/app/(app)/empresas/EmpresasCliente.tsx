"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconBuilding } from "@tabler/icons-react";
import type { EmpresaResumo } from "@/server/empresas/consultas";
import { salvarEmpresa } from "@/server/empresas/acoes";
import { Avatar } from "@/components/Avatar";
import { BadgeEstado } from "@/components/BadgeEstado";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { LinhaCampo } from "@/components/LinhaCampo";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { useFiltrosUrl } from "@/lib/filtros-url";
import { Paginacao } from "@/components/Paginacao";
import { ColunaOrdenavel } from "@/components/ColunaOrdenavel";
import {
  EMPRESAS_POR_PAGINA,
  camposDosFiltrosEmpresas,
  filtrosEmpresasParaQuery,
  hrefDosCamposEmpresas,
  hrefEmpresas,
  lerFiltrosEmpresas,
  parametrosFiltrosEmpresas,
  temFiltroEmpresas,
  type FiltrosEmpresas,
} from "@/server/empresas/filtros";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { CampoCombobox } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const btnPri = botaoClasses();

const hrefPagina = (f: FiltrosEmpresas, pagina: number) => {
  const q = filtrosEmpresasParaQuery({ ...f, pagina });
  return q ? `/empresas?${q}` : "/empresas";
};

export function EmpresasCliente({
  empresas,
  total,
  totalBase,
  filtros,
  paises,
  podeEditar = true,
}: {
  empresas: EmpresaResumo[];
  total: number;
  totalBase: number;
  filtros: FiltrosEmpresas;
  paises: { id: string; nome: string }[];
  podeEditar?: boolean;
}) {
  const router = useRouter();
  const filtrando = temFiltroEmpresas(filtros);
  const inicio = total ? (filtros.pagina - 1) * EMPRESAS_POR_PAGINA + 1 : 0;
  const fim = (filtros.pagina - 1) * EMPRESAS_POR_PAGINA + empresas.length;
  const lista = useFiltrosUrl({ campos: camposDosFiltrosEmpresas(filtros), hrefDosCampos: (c) => hrefDosCamposEmpresas(c, filtros.ordem) });
  const limpar = hrefEmpresas({ ...lerFiltrosEmpresas({}), ordem: filtros.ordem });
  const ordemPadrao = hrefEmpresas({ ...filtros, ordem: null, pagina: 1 });
  const coluna = { ordenacao: filtros.ordem, rota: "/empresas", parametros: parametrosFiltrosEmpresas(filtros), aoClicar: lista.aoClicar };
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [paisId, setPaisId] = useState("");
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();

  async function criar() {
    const d = await acao.executar(() => salvarEmpresa({ nome, paisId, chaveIdempotencia: tentativa.atual }));
    tentativa.depoisDo(d);
    if (d?.tipo !== "ok") return;
    setCriando(false);
    setNome("");
    if (d.dado) router.push(`/empresas/${d.dado.id}`);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">Empresas (B2B)</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cadastro do responsável financeiro para contratos individuais e consulta de faturas históricas.
          </p>
        </div>
        {podeEditar && <button className={btnPri} onClick={() => setCriando((v) => !v)}>Nova empresa</button>}
      </div>

      {podeEditar && criando && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-surface p-4">
          <label className="w-72 text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-600">Nome da empresa</span>
            <input className={CONTROLE_CAMPO} value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="w-64 text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-600">País (moeda/vencimentos)</span>
            <CampoCombobox value={paisId} onValueChange={setPaisId} vazio="—" opcoes={paises.map((p) => ({ valor: p.id, rotulo: p.nome }))} />
          </label>
          <button className={btnPri} disabled={acao.ocupado || nome.trim().length < 2} onClick={criar}>
            {acao.ocupado ? "Criando…" : "Criar"}
          </button>
          <FeedbackAcao erro={acao.erro} className="basis-full" />
        </div>
      )}

      <div>
        <form
          action="/empresas"
          onSubmit={(e) => { e.preventDefault(); lista.aplicar(lista.campos); }}
          className="mb-3 flex flex-wrap items-center gap-2"
          role="search"
          aria-label="Filtrar empresas"
        >
          <div className="w-64">
            <input
              name="busca"
              value={lista.campos.busca}
              onChange={lista.mudarTexto("busca")}
              maxLength={100}
              aria-label="Buscar empresa por nome ou código"
              placeholder="Buscar por nome ou código…"
              className={CONTROLE_CAMPO}
            />
          </div>
          <div className="w-48">
            <CampoCombobox name="situacao" value={lista.campos.situacao} onChange={lista.mudarSelect("situacao")} aria-label="Filtrar por situação" vazio="Ativas e inativas" opcoes={[{ valor: "ativas", rotulo: "Ativas" }, { valor: "inativas", rotulo: "Inativas" }]} />
          </div>
          <div className="w-56">
            <CampoCombobox name="pais" value={lista.campos.pais} onChange={lista.mudarSelect("pais")} aria-label="Filtrar por país" vazio="Todos os países" opcoes={paises.map((p) => ({ valor: p.id, rotulo: p.nome }))} />
          </div>
          {filtros.ordem && <>
            <input type="hidden" name="ordem" value={filtros.ordem.campo} />
            <input type="hidden" name="dir" value={filtros.ordem.dir} />
          </>}
          <button type="submit" disabled={lista.buscando} className={botaoClasses({ variante: "secundario" })}>
            {lista.buscando ? "Buscando…" : "Buscar"}
          </button>
          {filtrando && <Link href={limpar} onClick={lista.aoClicar(limpar)} className="text-sm text-brand-700 hover:underline">Limpar filtros</Link>}
          {filtros.ordem !== null && <Link href={ordemPadrao} onClick={lista.aoClicar(ordemPadrao)} className="text-sm text-brand-700 hover:underline">Voltar à ordem padrão</Link>}
        </form>

        <p className="mb-2 text-xs text-gray-500" aria-live="polite">
          {lista.buscando ? "Buscando…" : total === 0 || empresas.length === 0 ? "Nenhuma empresa" : filtrando
            ? `${inicio}–${fim} de ${total} ${total === 1 ? "empresa encontrada" : "empresas encontradas"} (de ${totalBase} no total)`
            : `${inicio}–${fim} de ${total} ${total === 1 ? "empresa" : "empresas"}`}
        </p>

        {empresas.length === 0 ? (
          <EstadoVazio bloco aria-busy={lista.buscando}>
            {totalBase === 0 ? "Nenhuma empresa ainda. Crie a primeira para registrar o responsável financeiro de contratos individuais." : filtrando ? (
              <>Nenhuma empresa com esses filtros. <Link href={limpar} onClick={lista.aoClicar(limpar)} className="text-brand-700 hover:underline">Limpar filtros</Link></>
            ) : (
              <>Nenhuma empresa nesta página. <Link href={limpar} onClick={lista.aoClicar(limpar)} className="text-brand-700 hover:underline">Ir para a primeira página</Link></>
            )}
          </EstadoVazio>
        ) : (
          <div aria-busy={lista.buscando} className={"overflow-x-auto rounded-lg border border-gray-200 transition-opacity " + (lista.buscando ? "opacity-60" : "")}>
            <Table className="min-w-[640px]">
              <TableHeader className="bg-surface-muted text-left text-xs text-gray-600">
                <TableRow className="hover:bg-transparent">
                  <ColunaOrdenavel campo="codigo" rotulo="Código" {...coluna} />
                  <ColunaOrdenavel campo="nome" rotulo="Empresa" {...coluna} />
                  <TableHead className="px-4 py-2 font-medium">País</TableHead>
                  <ColunaOrdenavel campo="colaboradores" rotulo="Colaboradores" direcaoInicial="desc" {...coluna} />
                  <TableHead className="px-4 py-2 font-medium">Faturas a receber</TableHead>
                  <ColunaOrdenavel campo="situacao" rotulo="Status" {...coluna} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresas.map((e) => (
                  <TableRow key={e.id} className="transition-colors hover:bg-surface-muted">
                    <TableCell className="px-4 py-2 font-mono tabular-nums text-gray-500">{e.codigo ? `#${e.codigo}` : "—"}</TableCell>
                    <TableCell className="px-4 py-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar nome={e.nome} tamanho={32} quadrado />
                        <div className="min-w-0">
                          <Link href={`/empresas/${e.id}`} className="font-medium text-gray-800 hover:underline">
                            {e.nome}
                          </Link>
                          <LinhaCampo icone={<IconBuilding size={18} />} valor={e.pais ?? "—"} rotulo="País" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2 text-gray-500">{e.pais ?? "—"}</TableCell>
                    <TableCell className="px-4 py-2 font-mono tabular-nums text-gray-700">{e.colaboradores}</TableCell>
                    <TableCell className="px-4 py-2 font-mono tabular-nums text-gray-700">{e.faturasAReceber}</TableCell>
                    <TableCell className="px-4 py-2">
                      <BadgeEstado tom={e.ativo ? "sucesso" : "neutro"} ponto>{e.ativo ? "Ativa" : "Inativa"}</BadgeEstado>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Paginacao
          pagina={filtros.pagina}
          temProxima={fim < total}
          href={(p) => hrefPagina(filtros, p)}
          aoClicar={lista.aoClicar}
          rotulo="Páginas de empresas"
        />
      </div>
    </div>
  );
}
