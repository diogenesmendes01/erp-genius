"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusAluno } from "@prisma/client";
import { STATUS_ALUNO_LABEL } from "@/lib/labels";
import { ImportarAlunosModal } from "./ImportarAlunosModal";

export interface AlunoRow {
  id: string;
  codigo: string | null;
  nome: string;
  status: StatusAluno;
  pais: string;
  turma: { id: string; label: string } | null;
  financeiro: { atrasado: boolean; emAberto: { moeda: string; valor: number }[] };
}

const STATUS_CLS: Record<StatusAluno, string> = {
  ATIVO: "bg-green-100 text-green-700",
  PAUSADO: "bg-amber-100 text-amber-700",
  ENCERRADO: "bg-gray-200 text-gray-500",
};

export function AlunosLista({
  alunos,
  podeCadastrar = false,
  podeImportar = false,
}: {
  alunos: AlunoRow[];
  podeCadastrar?: boolean;
  podeImportar?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [pais, setPais] = useState("");
  const [turma, setTurma] = useState("");

  const paisesOpts = useMemo(() => Array.from(new Set(alunos.map((a) => a.pais))).sort(), [alunos]);
  const turmasOpts = useMemo(
    () => Array.from(new Set(alunos.map((a) => a.turma?.label).filter(Boolean) as string[])).sort(),
    [alunos],
  );

  const filtrados = useMemo(
    () =>
      alunos.filter(
        (a) =>
          (!status || a.status === status) &&
          (!pais || a.pais === pais) &&
          (!turma || a.turma?.label === turma) &&
          (!busca ||
            a.nome.toLowerCase().includes(busca.toLowerCase()) ||
            (a.codigo ?? "").toLowerCase().includes(busca.toLowerCase())),
      ),
    [alunos, busca, status, pais, turma],
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-medium">Alunos</h1>
        <div className="flex items-center gap-2">
          {podeImportar && <ImportarAlunosModal />}
          {podeCadastrar && (
            <Link
              href="/matriculas/nova"
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Cadastrar aluno
            </Link>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou código…"
          className="w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500"
        >
          <option value="">Todos os status</option>
          {Object.values(StatusAluno).map((s) => (
            <option key={s} value={s}>
              {STATUS_ALUNO_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={pais}
          onChange={(e) => setPais(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500"
        >
          <option value="">Todos os países</option>
          {paisesOpts.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={turma}
          onChange={(e) => setTurma(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500"
        >
          <option value="">Todas as turmas</option>
          {turmasOpts.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Aluno</th>
              <th className="px-4 py-2 font-medium">País</th>
              <th className="px-4 py-2 font-medium">Turma</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Financeiro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">
                  Nenhum aluno.
                </td>
              </tr>
            ) : (
              filtrados.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/alunos/${a.id}`} className="font-medium text-brand-700 hover:underline">
                      {a.nome}
                    </Link>
                    <div className="text-xs text-gray-400">{a.codigo}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.pais}</td>
                  <td className="px-4 py-3 text-gray-600">{a.turma?.label ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_CLS[a.status]}>
                      {STATUS_ALUNO_LABEL[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {a.financeiro.atrasado ? (
                      <span className="text-red-600">Em atraso</span>
                    ) : (
                      <span className="text-green-600">Em dia</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
