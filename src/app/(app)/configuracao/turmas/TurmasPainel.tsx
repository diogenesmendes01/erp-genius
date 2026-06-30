"use client";

import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { TurmaFormulario, type TurmaParaEditar, type Opcao, type ModalidadeOpcao } from "./TurmaFormulario";
import { ImportarTurmasModal } from "./ImportarTurmasModal";

export interface TurmaRow {
  id: string;
  codigo: string | null;
  nome: string | null;
  online: boolean;
  diasHorario: string | null;
  diasSemana: number[];
  horarioInicio: string | null;
  horarioFim: string | null;
  dataInicio: string | null; // ISO ou null
  dataFim: string | null; // ISO ou null
  capacidade: number;
  rolling: boolean;
  modalidadeId: string;
  nivelId: string;
  modalidade: { nome: string };
  nivel: { codigo: string; idioma: { nome: string } };
  professor: { id: string; nome: string } | null;
  _count: { alocacoes: number };
}

/**
 * Situação da turma DERIVADA das datas (sem cron):
 * - início no futuro  → "Aceitando matrícula" (aparece no wizard de matrícula)
 * - já iniciou, não terminou → "Em andamento"
 * - passou do fim → "Encerrada"
 */
function situacao(dataInicio: string | null, dataFim: string | null): { label: string; cls: string } {
  if (!dataInicio || !dataFim) return { label: "Sem datas", cls: "bg-gray-100 text-gray-500" };
  const agora = Date.now();
  const ini = new Date(dataInicio).getTime();
  const fim = new Date(dataFim).getTime();
  if (agora < ini) return { label: "Aceitando matrícula", cls: "bg-green-100 text-green-700" };
  if (agora <= fim) return { label: "Em andamento", cls: "bg-blue-100 text-blue-700" };
  return { label: "Encerrada", cls: "bg-gray-200 text-gray-500" };
}

export function TurmasPainel({
  turmas,
  modalidades,
  niveis,
  professores,
  podeImportar = false,
}: {
  turmas: TurmaRow[];
  modalidades: ModalidadeOpcao[];
  niveis: Opcao[];
  professores: Opcao[];
  podeImportar?: boolean;
}) {
  const [form, setForm] = useState<"none" | "nova" | { editar: TurmaParaEditar }>("none");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Onde a turma nasce (criar × alocar). Turmas com <strong>início no futuro</strong> ficam{" "}
          <strong>aceitando matrícula</strong> e aparecem no wizard; após o início, saem automaticamente.
        </p>
        {form === "none" && (
          <div className="flex items-center gap-2">
            {podeImportar && <ImportarTurmasModal />}
            <button
              onClick={() => setForm("nova")}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <IconPlus className="h-4 w-4" /> Nova turma
            </button>
          </div>
        )}
      </div>

      {form !== "none" && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setForm("none")}
        >
          <div
            className="my-8 w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <TurmaFormulario
              turma={typeof form === "object" ? form.editar : undefined}
              modalidades={modalidades}
              niveis={niveis}
              professores={professores}
              onClose={() => setForm("none")}
            />
          </div>
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
                <th className="px-4 py-2 font-medium">Período</th>
                <th className="px-4 py-2 font-medium">Professor</th>
                <th className="px-4 py-2 font-medium">Ocupação</th>
                <th className="px-4 py-2 font-medium">Situação</th>
                <th className="px-4 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {turmas.map((t) => {
                // _count.alocacoes já vem filtrado por { ativa: true } (ver listarTurmas).
                const vagas = Math.max(0, t.capacidade - t._count.alocacoes);
                const sit = situacao(t.dataInicio, t.dataFim);
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
                      {t.dataFim ? ` → ${new Date(t.dataFim).toLocaleDateString("pt-BR")}` : ""}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.professor?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {t._count.alocacoes} matriculados · {vagas} vagas
                    </td>
                    <td className="px-4 py-3">
                      <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + sit.cls}>
                        {sit.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            setForm({
                              editar: {
                                id: t.id,
                                nome: t.nome ?? "",
                                modalidadeId: t.modalidadeId,
                                nivelId: t.nivelId,
                                professorId: t.professor?.id ?? "",
                                diasSemana: t.diasSemana,
                                horarioInicio: t.horarioInicio ?? "",
                                horarioFim: t.horarioFim ?? "",
                                dataInicio: t.dataInicio ? t.dataInicio.slice(0, 10) : "",
                                dataFim: t.dataFim ? t.dataFim.slice(0, 10) : "",
                                capacidade: t.capacidade,
                                rolling: t.rolling,
                              },
                            })
                          }
                          className="text-xs text-brand-700 hover:text-brand-800"
                        >
                          Editar
                        </button>
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
