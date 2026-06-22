"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusTurma } from "@prisma/client";
import { IconPlus } from "@tabler/icons-react";
import { alterarStatusTurma } from "@/server/turmas/acoes";
import { TurmaFormulario, type TurmaParaEditar, type Opcao } from "./TurmaFormulario";

export interface TurmaRow {
  id: string;
  codigo: string | null;
  nome: string | null;
  online: boolean;
  diasHorario: string | null;
  dataInicio: string | null; // ISO ou null
  capacidade: number;
  rolling: boolean;
  status: StatusTurma;
  modalidadeId: string;
  nivelId: string;
  modalidade: { nome: string };
  nivel: { codigo: string; idioma: { nome: string } };
  professor: { id: string; nome: string } | null;
  _count: { alocacoes: number };
}

const STATUS_INFO: Record<StatusTurma, { label: string; cls: string }> = {
  PLANEJADA: { label: "Planejada", cls: "bg-gray-100 text-gray-600" },
  ABERTA: { label: "Aberta", cls: "bg-green-100 text-green-700" },
  EM_ANDAMENTO: { label: "Em andamento", cls: "bg-blue-100 text-blue-700" },
  CONCLUIDA: { label: "Concluída", cls: "bg-gray-200 text-gray-500" },
};

const PROXIMO: Partial<Record<StatusTurma, { label: string; alvo: StatusTurma }>> = {
  PLANEJADA: { label: "Abrir", alvo: StatusTurma.ABERTA },
  ABERTA: { label: "Iniciar", alvo: StatusTurma.EM_ANDAMENTO },
  EM_ANDAMENTO: { label: "Concluir", alvo: StatusTurma.CONCLUIDA },
};

export function TurmasPainel({
  turmas,
  modalidades,
  niveis,
  professores,
}: {
  turmas: TurmaRow[];
  modalidades: Opcao[];
  niveis: Opcao[];
  professores: Opcao[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<"none" | "nova" | { editar: TurmaParaEditar }>("none");

  async function mudar(id: string, alvo: StatusTurma) {
    setErro(null);
    const res = await alterarStatusTurma(id, alvo);
    if (!res.ok) setErro(res.erro);
    else router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Onde a turma nasce (criar × alocar). Só turma <strong>Aberta com vaga</strong> aparece na matrícula.
        </p>
        {form === "none" && (
          <button
            onClick={() => setForm("nova")}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <IconPlus className="h-4 w-4" /> Nova turma
          </button>
        )}
      </div>

      {erro && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {form !== "none" && (
        <div className="mb-6">
          <TurmaFormulario
            turma={typeof form === "object" ? form.editar : undefined}
            modalidades={modalidades}
            niveis={niveis}
            professores={professores}
            onClose={() => setForm("none")}
          />
        </div>
      )}

      {turmas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
          Nenhuma turma cadastrada.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Turma</th>
                <th className="px-4 py-2 font-medium">Dias/horário</th>
                <th className="px-4 py-2 font-medium">Início</th>
                <th className="px-4 py-2 font-medium">Professor</th>
                <th className="px-4 py-2 font-medium">Ocupação</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {turmas.map((t) => {
                const vagas = t.capacidade - t._count.alocacoes;
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">
                        {t.nome ? t.nome : `${t.modalidade.nome} · ${t.nivel.idioma.nome} ${t.nivel.codigo}`}
                        <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                          {t.online ? "online" : "presencial"}
                        </span>
                        {t.rolling && (
                          <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                            rolling
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {t.nome ? `${t.modalidade.nome} · ${t.nivel.idioma.nome} ${t.nivel.codigo} · ` : ""}
                        {t.codigo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {t.diasHorario ?? <span className="text-gray-400 italic">a definir</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {t.dataInicio ? new Date(t.dataInicio).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.professor?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {t._count.alocacoes} matriculados · {vagas} vagas
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_INFO[t.status].cls
                        }
                      >
                        {STATUS_INFO[t.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            setForm({
                              editar: {
                                id: t.id,
                                modalidadeId: t.modalidadeId,
                                nivelId: t.nivelId,
                                professorId: t.professor?.id ?? "",
                                diasHorario: t.diasHorario ?? "",
                                dataInicio: t.dataInicio ? t.dataInicio.slice(0, 10) : "",
                                capacidade: t.capacidade,
                                rolling: t.rolling,
                              },
                            })
                          }
                          className="text-xs text-brand-700 hover:text-brand-800"
                        >
                          Editar
                        </button>
                        {PROXIMO[t.status] && (
                          <button
                            onClick={() => mudar(t.id, PROXIMO[t.status]!.alvo)}
                            className="text-xs text-gray-500 hover:text-gray-800"
                          >
                            {PROXIMO[t.status]!.label}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
