"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DiarioTurma, ProgressaoAluno } from "@/server/academico/consultas";
import { aprovarNivelAluno, lancarNotas, registrarAula, salvarAvaliacao } from "@/server/academico/acoes";

// FASE 3 — acadêmico da turma: DIÁRIO (aula + frequência), AVALIAÇÕES (notas) e
// PROGRESSÃO (o sistema calcula média/frequência e SUGERE; aprovar emite o certificado).

const btnPri = "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
const btnSec = "rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60";
const inputCls = "rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500";

export function TurmaAcademico({
  turmaId,
  diario,
  progressao,
  podeEditar,
  podeAprovar,
}: {
  turmaId: string;
  diario: DiarioTurma;
  progressao: ProgressaoAluno[];
  podeEditar: boolean;
  podeAprovar: boolean;
}) {
  const router = useRouter();
  const [aba, setAba] = useState<"diario" | "avaliacoes" | "progressao">("diario");
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function run(p: Promise<{ ok: boolean; erro?: string }>, sucesso: string) {
    setOcupado(true);
    setErro(null);
    setNota(null);
    const r = await p;
    setOcupado(false);
    if (!r.ok) return setErro(r.erro ?? "Erro.");
    setNota(sucesso);
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-surface p-4">
      <div className="mb-3 flex gap-1">
        {(
          [
            ["diario", "Diário de classe"],
            ["avaliacoes", "Avaliações e notas"],
            ["progressao", "Progressão"],
          ] as const
        ).map(([chave, rotulo]) => (
          <button
            key={chave}
            className={
              "rounded-md px-3 py-1.5 text-sm " +
              (aba === chave ? "bg-brand-600 font-medium text-white" : "text-gray-600 hover:bg-gray-100")
            }
            onClick={() => setAba(chave)}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {erro && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {nota && <p className="mb-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{nota}</p>}

      {aba === "diario" && (
        <Diario turmaId={turmaId} diario={diario} podeEditar={podeEditar} ocupado={ocupado} run={run} />
      )}
      {aba === "avaliacoes" && (
        <Avaliacoes turmaId={turmaId} diario={diario} podeEditar={podeEditar} ocupado={ocupado} run={run} />
      )}
      {aba === "progressao" && (
        <Progressao turmaId={turmaId} progressao={progressao} podeAprovar={podeAprovar} ocupado={ocupado} run={run} />
      )}
    </section>
  );
}

type Run = (p: Promise<{ ok: boolean; erro?: string }>, sucesso: string) => Promise<void>;

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Diario({
  turmaId,
  diario,
  podeEditar,
  ocupado,
  run,
}: {
  turmaId: string;
  diario: DiarioTurma;
  podeEditar: boolean;
  ocupado: boolean;
  run: Run;
}) {
  const [data, setData] = useState(hojeISO());
  const [conteudo, setConteudo] = useState("");
  const [presentes, setPresentes] = useState<Record<string, boolean>>(
    Object.fromEntries(diario.alunos.map((a) => [a.id, true])),
  );

  return (
    <div className="flex flex-col gap-4">
      {podeEditar && (
        <div className="rounded-md border border-gray-200 bg-surface-muted p-3">
          <div className="mb-2 text-sm font-medium text-gray-700">Registrar aula</div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-600">Data</span>
              <input type="date" className={inputCls} value={data} onChange={(e) => setData(e.target.value)} />
            </label>
            <label className="min-w-64 flex-1 text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-600">Conteúdo (opcional)</span>
              <input className={inputCls + " w-full"} value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {diario.alunos.map((a) => (
              <label key={a.id} className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={presentes[a.id] ?? true}
                  onChange={(e) => setPresentes((p) => ({ ...p, [a.id]: e.target.checked }))}
                />
                {a.nome}
              </label>
            ))}
          </div>
          <button
            className={btnPri + " mt-3"}
            disabled={ocupado || !data || diario.alunos.length === 0}
            onClick={() =>
              run(
                registrarAula({
                  turmaId,
                  dataISO: data,
                  conteudo,
                  presencas: diario.alunos.map((a) => ({ alunoId: a.id, presente: presentes[a.id] ?? true })),
                }),
                "Aula registrada (re-registrar a mesma data edita).",
              )
            }
          >
            Registrar aula e frequência
          </button>
        </div>
      )}

      {diario.aulas.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma aula registrada.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {diario.aulas.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-gray-800">{new Date(a.dataISO).toLocaleDateString("pt-BR")}</span>
                {a.conteudo && <span className="ml-2 text-gray-500">{a.conteudo}</span>}
              </span>
              <span className="text-gray-500">
                {a.presentes}/{a.total} presentes
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Avaliacoes({
  turmaId,
  diario,
  podeEditar,
  ocupado,
  run,
}: {
  turmaId: string;
  diario: DiarioTurma;
  podeEditar: boolean;
  ocupado: boolean;
  run: Run;
}) {
  const [nome, setNome] = useState("");
  const [peso, setPeso] = useState("1");
  const [notas, setNotas] = useState<Record<string, Record<string, string>>>({});

  function notaAtual(avaliacaoId: string, alunoId: string, existente: number | undefined): string {
    return notas[avaliacaoId]?.[alunoId] ?? (existente !== undefined ? String(existente) : "");
  }

  return (
    <div className="flex flex-col gap-4">
      {podeEditar && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-surface-muted p-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-600">Nova avaliação</span>
            <input className={inputCls} placeholder="Prova 1" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-600">Peso</span>
            <input type="number" min={0.1} max={10} step={0.1} className={inputCls + " w-20"} value={peso} onChange={(e) => setPeso(e.target.value)} />
          </label>
          <button
            className={btnSec}
            disabled={ocupado || !nome.trim()}
            onClick={() => run(salvarAvaliacao({ turmaId, nome, peso: Number(peso) }), "Avaliação salva.")}
          >
            Criar avaliação
          </button>
        </div>
      )}

      {diario.avaliacoes.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma avaliação definida.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Aluno</th>
                {diario.avaliacoes.map((av) => (
                  <th key={av.id} className="px-3 py-2 font-medium">
                    {av.nome} <span className="font-normal text-gray-400">(peso {av.peso})</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {diario.alunos.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-medium text-gray-800">{a.nome}</td>
                  {diario.avaliacoes.map((av) => {
                    const existente = av.notas.find((n) => n.alunoId === a.id)?.valor;
                    return (
                      <td key={av.id} className="px-3 py-1.5">
                        {podeEditar ? (
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className={inputCls + " w-20"}
                            value={notaAtual(av.id, a.id, existente)}
                            onChange={(e) =>
                              setNotas((v) => ({ ...v, [av.id]: { ...v[av.id], [a.id]: e.target.value } }))
                            }
                          />
                        ) : (
                          <span className="text-gray-700">{existente ?? "—"}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {podeEditar && diario.avaliacoes.length > 0 && (
        <button
          className={btnPri + " self-start"}
          disabled={ocupado}
          onClick={() => {
            // Lança TODAS as notas preenchidas, avaliação por avaliação.
            const lancamentos = diario.avaliacoes
              .map((av) => ({
                avaliacaoId: av.id,
                notas: diario.alunos
                  .map((a) => {
                    const bruto = notaAtual(av.id, a.id, av.notas.find((n) => n.alunoId === a.id)?.valor);
                    return bruto === "" ? null : { alunoId: a.id, valor: Number(bruto) };
                  })
                  .filter((n): n is { alunoId: string; valor: number } => n !== null),
              }))
              .filter((l) => l.notas.length > 0);
            void (async () => {
              for (const l of lancamentos) {
                await run(lancarNotas(l), "Notas lançadas.");
              }
            })();
          }}
        >
          Salvar notas
        </button>
      )}
    </div>
  );
}

function Progressao({
  turmaId,
  progressao,
  podeAprovar,
  ocupado,
  run,
}: {
  turmaId: string;
  progressao: ProgressaoAluno[];
  podeAprovar: boolean;
  ocupado: boolean;
  run: Run;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-500">
        Sugestão automática: média ≥ 70 e frequência ≥ 75%. Aprovar emite o certificado do nível (com código de
        validação); alocar na próxima turma segue pela troca de turma na ficha do aluno.
      </p>
      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Aluno</th>
              <th className="px-3 py-2 font-medium">Frequência</th>
              <th className="px-3 py-2 font-medium">Média</th>
              <th className="px-3 py-2 font-medium">Sugestão</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {progressao.map((p) => (
              <tr key={p.alunoId}>
                <td className="px-3 py-2 font-medium text-gray-800">{p.nome}</td>
                <td className="px-3 py-2 text-gray-700">{p.frequenciaPct !== null ? `${p.frequenciaPct}%` : "—"}</td>
                <td className="px-3 py-2 text-gray-700">{p.media ?? "—"}</td>
                <td className="px-3 py-2">
                  {p.certificado ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      Nível concluído · {p.certificado.codigoValidacao}
                    </span>
                  ) : p.aprovadoSugerido ? (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Aprovar nível</span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Ainda não</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {podeAprovar && !p.certificado && (
                    <button
                      className={btnSec + (p.aprovadoSugerido ? " border-green-300 text-green-700" : "")}
                      disabled={ocupado}
                      title={p.aprovadoSugerido ? "Dentro do critério sugerido" : "Fora do critério — aprovação excepcional"}
                      onClick={() =>
                        run(aprovarNivelAluno(turmaId, p.alunoId), "Nível aprovado — certificado emitido.")
                      }
                    >
                      Aprovar nível + certificado
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
