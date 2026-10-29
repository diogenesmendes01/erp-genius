"use client";

import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { ModalidadeFormulario, type ModalidadeParaEditar } from "./ModalidadeFormulario";
import { botaoClasses } from "@/components/Botao";
import { SEGMENTO_LABEL } from "@/lib/labels";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
export interface ModalidadeRow extends ModalidadeParaEditar {
  _count: { produtos: number; turmas: number };
}

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
            key={typeof form === "object" ? form.editar.id : "nova"}
            modalidade={typeof form === "object" ? form.editar : undefined}
            onClose={() => setForm("none")}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table className="w-full min-w-[640px] text-sm">
          <TableHeader className="bg-surface-muted text-left text-xs text-gray-500">
            <TableRow>
              <TableHead className="px-4 py-2 font-medium">Modalidade</TableHead>
              <TableHead className="px-4 py-2 font-medium">Segmento</TableHead>
              <TableHead className="px-4 py-2 font-medium">Frequência</TableHead>
              <TableHead className="px-4 py-2 font-medium">Duração</TableHead>
              <TableHead className="px-4 py-2 font-medium">Aulas/nível</TableHead>
              <TableHead className="px-4 py-2 font-medium">Mín.</TableHead>
              <TableHead className="px-4 py-2 font-medium text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100">
            {modalidades.map((m) => (
              <TableRow key={m.id} className="hover:bg-highlight">
                <TableCell className="px-4 py-3 font-medium text-gray-800">{m.nome}</TableCell>
                <TableCell className="px-4 py-3 text-gray-600">{SEGMENTO_LABEL[m.segmento]}</TableCell>
                <TableCell className="px-4 py-3 text-gray-600">{m.frequencia}</TableCell>
                <TableCell className="px-4 py-3 text-gray-600">{m.duracaoPorNivel}</TableCell>
                <TableCell className="px-4 py-3 text-gray-600">{m.aulasPorNivel ?? "—"}</TableCell>
                <TableCell className="px-4 py-3 text-gray-600">{m.minimoAbrir}</TableCell>
                <TableCell className="px-4 py-3 text-right">
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
                    className={botaoClasses({ variante: "fantasma", tamanho: "sm" })}
                  >
                    Editar
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
