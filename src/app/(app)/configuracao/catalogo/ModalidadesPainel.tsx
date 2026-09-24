"use client";

import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { Segmento } from "@prisma/client";
import { ModalidadeFormulario, type ModalidadeParaEditar } from "./ModalidadeFormulario";
import { botaoClasses } from "@/components/Botao";

export interface ModalidadeRow extends ModalidadeParaEditar {
  _count: { produtos: number; turmas: number };
}

const SEG_LABEL: Record<Segmento, string> = {
  ADULTO: "Adulto",
  KIDS: "Kids",
  TEENS: "Teens",
  EMPRESA: "Empresa",
};

export function ModalidadesPainel({ modalidades }: { modalidades: ModalidadeRow[] }) {
  const [form, setForm] = useState<"none" | "nova" | { editar: ModalidadeParaEditar }>("none");

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Modalidades</h2>
        {form === "none" && (
          <button
            onClick={() => setForm("nova")}
            className={botaoClasses({ tamanho: "md" })}
          >
            <IconPlus className="h-4 w-4" /> Nova modalidade
          </button>
        )}
      </div>
      <p className="mb-3 text-sm text-gray-500">
        Como o curso funciona (ritmo, duração, nº de aulas). O <strong>mínimo para abrir</strong> vive aqui.
      </p>

      {form !== "none" && (
        <div className="mb-4">
          <ModalidadeFormulario
            modalidade={typeof form === "object" ? form.editar : undefined}
            onClose={() => setForm("none")}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Modalidade</th>
              <th className="px-4 py-2 font-medium">Segmento</th>
              <th className="px-4 py-2 font-medium">Frequência</th>
              <th className="px-4 py-2 font-medium">Duração</th>
              <th className="px-4 py-2 font-medium">Aulas/nível</th>
              <th className="px-4 py-2 font-medium">Mín.</th>
              <th className="px-4 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {modalidades.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{m.nome}</td>
                <td className="px-4 py-3 text-gray-600">{SEG_LABEL[m.segmento]}</td>
                <td className="px-4 py-3 text-gray-600">{m.frequencia}</td>
                <td className="px-4 py-3 text-gray-600">{m.duracaoPorNivel}</td>
                <td className="px-4 py-3 text-gray-600">{m.aulasPorNivel ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{m.minimoAbrir}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() =>
                      setForm({
                        editar: {
                          id: m.id,
                          nome: m.nome,
                          segmento: m.segmento,
                          frequencia: m.frequencia,
                          horasAula: m.horasAula,
                          duracaoPorNivel: m.duracaoPorNivel,
                          aulasPorNivel: m.aulasPorNivel,
                          minimoAbrir: m.minimoAbrir,
                        },
                      })
                    }
                    className="text-xs text-brand-700 hover:text-brand-800"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
