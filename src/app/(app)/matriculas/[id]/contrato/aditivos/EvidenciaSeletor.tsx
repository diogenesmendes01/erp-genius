"use client";

export type EvidenciaDisponivel = { id: string; nome: string; categoria: string };

/** A seleção fica no formulário mesmo ao consultar outra página de documentos. */
export function EvidenciaSeletor({ nome, titulo, documentos, selecionada, onChange, disabled }: {
  nome: string;
  titulo: string;
  documentos: EvidenciaDisponivel[];
  selecionada: EvidenciaDisponivel | null;
  onChange: (documento: EvidenciaDisponivel | null) => void;
  disabled: boolean;
}) {
  const opcoes = selecionada && !documentos.some(d => d.id === selecionada.id)
    ? [selecionada, ...documentos] : documentos;
  return <label className="block">{titulo}
    <select name={nome} className="mt-1 block w-full rounded border p-2" required
      disabled={disabled} value={selecionada?.id ?? ""}
      onChange={e => onChange(opcoes.find(d => d.id === e.target.value) ?? null)}>
      <option value="">Selecione uma evidência</option>
      {opcoes.map(d => <option key={d.id} value={d.id}>{d.nome} · {d.categoria}</option>)}
    </select>
  </label>;
}
