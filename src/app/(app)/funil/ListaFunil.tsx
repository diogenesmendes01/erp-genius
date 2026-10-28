"use client";

import { Avatar } from "@/components/Avatar";
import { BadgeEstado } from "@/components/BadgeEstado";
import { ColunaOrdenavel } from "@/components/ColunaOrdenavel";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      <Table className="text-left">
        <TableHeader className="bg-surface-muted text-left text-xs text-gray-600">
          <TableRow>
            <TableHead scope="col" className="w-11 px-1 py-0">
              <label className={CAIXA}>
                <Checkbox
                  aria-label="Selecionar todas as oportunidades"
                  checked={todos}
                  onCheckedChange={() => aoSelecionar(todos ? [] : cartoes.map((c) => c.id))}
                />
              </label>
            </TableHead>
            <TableHead scope="col" className={cab}>Oportunidade</TableHead>
            <TableHead scope="col" className={cab}>Etapa</TableHead>
            <TableHead scope="col" className={cab}>Responsável</TableHead>
            <TableHead scope="col" className={cab}>Temperatura</TableHead>
            {ord("valor", "Valor", "desc")}
            {ord("proxima", "Ação seguinte", "asc")}
            {ord("tempo", "Tempo na etapa", "asc")}
          </TableRow>
        </TableHeader>
        <TableBody>
          {cartoes.map((c) => {
            const proxima = proximaAcaoDoCartao(c, referencia, fuso);
            return (
              <TableRow key={c.id} className="hover:bg-surface-muted">
                <TableCell className="px-1 py-0">
                  <label className={CAIXA}>
                    <Checkbox
                      aria-label={`Selecionar ${c.nome}`}
                      checked={marcados.has(c.id)}
                      onCheckedChange={() => alternar(c.id)}
                    />
                  </label>
                </TableCell>
                <TableCell className="px-4 py-2">
                  <button type="button" onClick={() => aoAbrir(c.id)} className="flex items-center gap-2 text-left max-sm:min-h-11">
                    <Avatar nome={c.nome} tamanho={32} />
                    <span>
                      <span className="block font-medium">{c.nome}</span>
                      <span className="block font-mono text-xs tabular-nums text-gray-600">{c.codigo ? `#${c.codigo}` : "Sem código"}</span>
                    </span>
                  </button>
                </TableCell>
                <TableCell className="px-4 py-2"><BadgeEstado tom="brand" ponto>{ETAPA_LABEL[c.etapa]}</BadgeEstado></TableCell>
                <TableCell className="px-4 py-2">
                  {c.dono ? (
                    <div className="flex items-center gap-2"><Avatar nome={c.dono.nome} tamanho={32} /><span>{c.dono.nome}</span></div>
                  ) : "Sem responsável"}
                </TableCell>
                <TableCell className="px-4 py-2"><Temperatura temperatura={c.temperatura} /></TableCell>
                <TableCell className="px-4 py-2 font-mono tabular-nums">{c.valorPrevisto && c.moeda ? valorComMoeda(c.valorPrevisto, c.moeda) : "—"}</TableCell>
                <TableCell className={"px-4 py-2 " + (proxima?.vencida ? "text-red-700" : "")}>{proxima?.texto ?? "—"}</TableCell>
                <TableCell className="px-4 py-2">{textoDiasNaEtapa(c.etapaDesde, referencia, fuso)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
