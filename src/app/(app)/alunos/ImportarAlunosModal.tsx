"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";

interface ResultadoImport {
  total: number;
  criados: number;
  erros: { linha: number; motivo: string }[];
}

const btnPri = "rounded-md bg-brand-solid px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60";
const btnSec = "rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50";

/** Modal de cadastro de alunos em lote (XLSX) — exibido só para administrador (doc 22). */
export function ImportarAlunosModal() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const planilhaId = useId();
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<ResultadoImport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function fechar() {
    setAberto(false);
    setRes(null);
    setErro(null);
    setEnviando(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function enviar() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErro("Selecione um arquivo .xlsx.");
      return;
    }
    setErro(null);
    setRes(null);
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/alunos/importar", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) {
        setErro(data?.erro ?? "Falha na importação.");
      } else {
        setRes(data as ResultadoImport);
        if (data.criados > 0) router.refresh();
      }
    } catch {
      setErro("Erro de rede. Tente novamente.");
    }
    setEnviando(false);
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={btnSec}>
        Cadastrar por lote
      </button>

      {aberto && (
        <Modal titulo="Cadastrar alunos por lote" aoFechar={fechar} bloquearFechamento={enviando || !!res} largura="max-w-lg">
          <p className="mb-4 text-sm text-gray-500">
            Envie uma planilha <strong>.xlsx</strong>. Apenas <strong>Nome</strong> e{" "}
            <strong>País</strong> são obrigatórios; os demais campos são opcionais. Baixe o modelo
            para ver as colunas e um exemplo.
          </p>

          <a
            href="/api/alunos/modelo"
            className="mb-4 inline-block text-sm font-medium text-brand-700 hover:underline"
          >
            ↓ Baixar modelo (.xlsx)
          </a>

          <div className="mb-3">
            <label htmlFor={planilhaId} className="mb-1 block text-xs text-gray-600">Planilha de alunos</label>
            <input
              id={planilhaId}
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-solid file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:brightness-95"
            />
          </div>

          {erro && <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

          {res && (
            <div className="mb-3 rounded-md border border-gray-200 p-3 text-sm">
              <p className="font-medium text-gray-800">
                {res.criados} de {res.total} aluno(s) cadastrado(s).
              </p>
              {res.erros.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-xs font-medium text-amber-700">
                    {res.erros.length} linha(s) com problema:
                  </p>
                  <ul className="max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-600">
                    {res.erros.map((e) => (
                      <li key={e.linha}>
                        Linha {e.linha}: {e.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className={btnSec} onClick={fechar}>
              {res ? "Fechar" : "Cancelar"}
            </button>
            <button type="button" className={btnPri} onClick={enviar} disabled={enviando}>
              {enviando ? "Enviando…" : "Importar"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
