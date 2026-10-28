"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { criarIdioma, definirIdiomaAtivo } from "@/server/catalogo/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { botaoClasses } from "@/components/Botao";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
export interface IdiomaRow {
  id: string;
  nome: string;
  ativo: boolean;
  niveis: { id: string; codigo: string; ordem: number }[];
  _count: { produtos: number };
}

const inputCls =
  "rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500";

export function IdiomasPainel({ idiomas }: { idiomas: IdiomaRow[] }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();
  const [origem, setOrigem] = useState<string | null>(null);

  async function adicionar() {
    if (!nome.trim()) return;
    setOrigem("novo");
    const d = await acao.executar(() => criarIdioma({ nome: nome.trim(), chaveIdempotencia: tentativa.atual }));
    tentativa.depoisDo(d);
    if (d?.tipo !== "ok") return;
    setNome("");
    router.refresh();
  }

  async function ativar(id: string) {
    setOrigem(id);
    const d = await acao.executar(() => definirIdiomaAtivo(id, true), "Idioma ativado.");
    if (d?.tipo === "ok") router.refresh();
  }

  const [desativando, setDesativando] = useState<IdiomaRow | null>(null);
  function pedirDesativacao(i: IdiomaRow) {
    setOrigem(i.id);
    acao.limpar();
    setDesativando(i);
  }
  function desativado(i: IdiomaRow) {
    setDesativando(null);
    setOrigem(i.id);
    acao.setSucesso("Idioma desativado.");
    router.refresh();
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">Idiomas</h2>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table className="w-full min-w-[640px] text-sm">
          <TableHeader className="bg-surface-muted text-left text-xs text-gray-500">
            <TableRow>
              <TableHead className="px-4 py-2 font-medium">Idioma</TableHead>
              <TableHead className="px-4 py-2 font-medium">Níveis</TableHead>
              <TableHead className="px-4 py-2 font-medium">Produtos</TableHead>
              <TableHead className="px-4 py-2 font-medium">Status</TableHead>
              <TableHead className="px-4 py-2 font-medium text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100">
            {idiomas.map((i) => (
              <TableRow key={i.id} className="hover:bg-highlight">
                <TableCell className="px-4 py-3 font-medium text-gray-800">{i.nome}</TableCell>
                <TableCell className="px-4 py-3 text-gray-600">{i.niveis.length}</TableCell>
                <TableCell className="px-4 py-3 text-gray-600">{i._count.produtos}</TableCell>
                <TableCell className="px-4 py-3">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-xs font-medium " +
                      (i.ativo ? "bg-green-100 text-green-700" : "bg-surface-muted text-gray-500")
                    }
                  >
                    {i.ativo ? "Ativo" : "Inativo"}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <button
                    onClick={() => (i.ativo ? pedirDesativacao(i) : ativar(i.id))}
                    disabled={acao.ocupado || desativando !== null}
                    className={botaoClasses({ variante: i.ativo ? "perigo" : "fantasma", tamanho: "sm" })}
                  >
                    {i.ativo ? "Desativar" : "Ativar"}
                  </button>
                  <FeedbackAcao erro={origem === i.id ? acao.erro : null} sucesso={origem === i.id ? acao.sucesso : undefined} className="mt-1 text-left" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-label="Nome do novo idioma"
          placeholder="Novo idioma (ex.: Inglês)"
          className={inputCls + " w-64"}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
        />
        <button
          onClick={adicionar}
          disabled={acao.ocupado}
          className={botaoClasses({ tamanho: "lg" })}
        >
          <IconPlus className="h-4 w-4" /> Adicionar
        </button>
      </div>
      <FeedbackAcao erro={origem === "novo" ? acao.erro : null} className="mt-3" />

      {desativando && (
        <ConfirmarAcao
          titulo={`Desativar ${desativando.nome}?`}
          confirmacao="desativação do idioma"
          idempotente
          acao={() => definirIdiomaAtivo(desativando.id, false)}
          aoConcluir={() => desativado(desativando)}
          aoCancelar={() => setDesativando(null)}
        >
          <p>
            {desativando._count.produtos === 1 ? "1 produto usa este idioma" : `${desativando._count.produtos} produtos usam este idioma`}
            {desativando.niveis.length ? ` (${desativando.niveis.length === 1 ? "1 nível" : `${desativando.niveis.length} níveis`})` : ""}.
          </p>
          <p>O idioma passa a inativo no catálogo. Os produtos, as matrículas e as turmas que já existem continuam cadastrados; para voltar, use &quot;Ativar&quot; nesta lista.</p>
        </ConfirmarAcao>
      )}
    </section>
  );
}
