import { IconCircle, IconCircleCheck } from "@tabler/icons-react";

export interface EnqueteDados { nome: string; selecionavel: number; opcoes: { texto: string; votos: number; escolhida?: boolean }[] }

/** Enquete só para leitura: mostra opções e totais; votar é do motor (Fase 4), então não há botão de voto. */
export function EnqueteLeitura({ enquete }: { enquete: EnqueteDados }) {
  const total = enquete.opcoes.reduce((s, o) => s + o.votos, 0);
  return (
    <div className="flex min-w-[220px] flex-col gap-2" data-enquete>
      <strong>{enquete.nome}</strong>
      <small className="text-gray-600">
        {enquete.selecionavel === 1 ? "Selecione uma opção" : `Selecione até ${enquete.selecionavel || enquete.opcoes.length} opções`}
      </small>
      <ul className="flex flex-col gap-2">
        {enquete.opcoes.map((o) => (
          <li key={o.texto} className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-sm">
              {o.escolhida ? <IconCircleCheck size={18} aria-label="Opção escolhida" /> : <IconCircle size={18} aria-hidden />}
              <span className="flex-1">{o.texto}</span>
              <b>{o.votos}</b>
            </span>
            <span className="h-1 rounded bg-gray-200"><i className="block h-1 rounded bg-brand-solid" style={{ width: `${total ? (o.votos / total) * 100 : 0}%` }} /></span>
          </li>
        ))}
      </ul>
      <small className="text-gray-600">{total} {total === 1 ? "voto" : "votos"} · somente leitura</small>
    </div>
  );
}
