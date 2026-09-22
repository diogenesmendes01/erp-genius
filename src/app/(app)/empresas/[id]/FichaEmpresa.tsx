"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColaboradorRelatorio, FaturaResumo } from "@/server/empresas/consultas";
import {
  cancelarFaturaB2B,
  pagarFaturaB2B,
  salvarEmpresa,
} from "@/server/empresas/acoes";

// FICHA DA EMPRESA: responsável financeiro, colaboradores e faturas históricas.
// A matrícula é preparada individualmente; lote corporativo não está disponível.

const btnPri = "rounded-md bg-brand-solid px-3 py-1.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60";
const btnSec = "rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60";
const inputCls = "rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500";

interface EmpresaFicha {
  id: string;
  codigo: string | null;
  nome: string;
  paisId: string | null;
  documento: string | null;
  contatoNome: string | null;
  contatoEmail: string | null;
  contatoTelefone: string | null;
  diaVencimento: number;
  observacoes: string | null;
  ativo: boolean;
}

const STATUS_FATURA: Record<string, string> = {
  ABERTA: "Aberta",
  FECHADA: "Fechada — a pagar",
  PAGA: "Paga",
  CANCELADA: "Cancelada",
};

export function FichaEmpresa({
  empresa,
  colaboradores,
  faturas,
  podePagar,
}: {
  empresa: EmpresaFicha;
  colaboradores: ColaboradorRelatorio[];
  faturas: FaturaResumo[];
  produtos: { id: string; label: string }[];
  competencias: string[];
  podePagar: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function run<T>(p: Promise<{ ok: boolean; erro?: string; dado?: T }>, sucesso?: string) {
    setOcupado(true);
    setErro(null);
    setNota(null);
    const r = await p;
    setOcupado(false);
    if (!r.ok) return setErro(r.erro ?? "Erro.");
    if (sucesso) setNota(sucesso);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium">{empresa.nome}</h1>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">B2B</span>
          {!empresa.ativo && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inativa</span>}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {empresa.codigo ?? "—"} · vencimento dia {empresa.diaVencimento}
          {empresa.contatoNome ? ` · contato: ${empresa.contatoNome}` : ""}
          {empresa.contatoEmail ? ` (${empresa.contatoEmail})` : ""}
        </p>
      </header>

      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {nota && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{nota}</p>}

      {/* Histórico de contratos individuais vinculados ao responsável financeiro. */}
      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Colaboradores ({colaboradores.length})</h2>
          <Link className={btnPri} href="/matriculas/nova">Preparar matrícula individual</Link>
        </div>
        <p className="mb-4 text-sm text-gray-500">A empresa pode ser o responsável financeiro, mas cada colaborador é preparado e contratado individualmente.</p>

        {colaboradores.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum contrato individual vinculado a esta empresa ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Colaborador</th>
                  <th className="px-3 py-2 font-medium">Matrícula</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Pagas</th>
                  <th className="px-3 py-2 font-medium">Abertas</th>
                  <th className="px-3 py-2 font-medium">Atrasadas</th>
                  <th className="px-3 py-2 font-medium">Total pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {colaboradores.map((c) => (
                  <tr key={c.matriculaId}>
                    <td className="px-3 py-2">
                      <Link href={`/alunos/${c.alunoId}`} className="font-medium text-gray-800 hover:underline">
                        {c.nome}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{c.codigo ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{c.statusMatricula}</td>
                    <td className="px-3 py-2 text-gray-700">{c.mensalidadesPagas}</td>
                    <td className="px-3 py-2 text-gray-700">{c.mensalidadesAbertas}</td>
                    <td className={"px-3 py-2 " + (c.mensalidadesAtrasadas > 0 ? "font-medium text-red-600" : "text-gray-700")}>
                      {c.mensalidadesAtrasadas}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {c.moeda} {c.totalPago.toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Faturas corporativas já registradas permanecem consultáveis e editáveis. */}
      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 font-medium">Faturas históricas</h2>

        {faturas.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nenhuma fatura histórica vinculada a esta empresa.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Fatura</th>
                  <th className="px-3 py-2 font-medium">Competência</th>
                  <th className="px-3 py-2 font-medium">Cobranças</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Vencimento</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {faturas.map((f) => (
                  <tr key={f.id}>
                    <td className="px-3 py-2 font-medium text-gray-800">{f.codigo ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{f.competencia}</td>
                    <td className="px-3 py-2 text-gray-600">{f.cobrancas}</td>
                    <td className="px-3 py-2 text-gray-800">
                      {f.moeda} {f.valorTotal.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{new Date(f.vencimento).toLocaleDateString("pt-BR")}</td>
                    <td className="px-3 py-2 text-gray-600">{STATUS_FATURA[f.status] ?? f.status}</td>
                    <td className="px-3 py-2">
                      {f.status === "FECHADA" && (
                        <span className="flex gap-1">
                          {podePagar && (
                            <button
                              className={btnSec + " border-green-300 text-green-700"}
                              disabled={ocupado}
                              onClick={() => run(pagarFaturaB2B(f.id), "Fatura paga — cobranças baixadas em lote.")}
                            >
                              Registrar pagamento
                            </button>
                          )}
                          <button
                            className={btnSec + " border-red-200 text-red-600"}
                            disabled={ocupado}
                            onClick={() => run(cancelarFaturaB2B(f.id), "Fatura cancelada.")}
                          >
                            Cancelar
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Dados do contrato */}
      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-2 font-medium">Contrato corporativo</h2>
        <dl className="grid grid-cols-1 gap-1 text-sm text-gray-700 md:grid-cols-2">
          <div><dt className="inline text-gray-500">Documento: </dt><dd className="inline">{empresa.documento ?? "—"}</dd></div>
          <div><dt className="inline text-gray-500">Telefone: </dt><dd className="inline">{empresa.contatoTelefone ?? "—"}</dd></div>
          <div className="md:col-span-2"><dt className="inline text-gray-500">Observações: </dt><dd className="inline">{empresa.observacoes ?? "—"}</dd></div>
        </dl>
        <button
          className={btnSec + " mt-3"}
          disabled={ocupado}
          onClick={() =>
            run(
              salvarEmpresa({
                id: empresa.id,
                nome: empresa.nome,
                paisId: empresa.paisId ?? undefined,
                documento: empresa.documento ?? undefined,
                contatoNome: empresa.contatoNome ?? undefined,
                contatoEmail: empresa.contatoEmail ?? undefined,
                contatoTelefone: empresa.contatoTelefone ?? undefined,
                diaVencimento: empresa.diaVencimento,
                observacoes: empresa.observacoes ?? undefined,
                ativo: !empresa.ativo,
              }),
              empresa.ativo ? "Empresa inativada." : "Empresa reativada.",
            )
          }
        >
          {empresa.ativo ? "Inativar empresa" : "Reativar empresa"}
        </button>
      </section>
    </div>
  );
}
