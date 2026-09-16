import type { z } from "zod";
import type { ConteudoRegraAvaliacaoSchema } from "@/server/avaliacoes/regra-schema";
export type ConteudoRegra = z.output<typeof ConteudoRegraAvaliacaoSchema>;
export const nomesHabilidades = { FALA: "Fala", COMPREENSAO_ORAL: "Compreensão oral", LEITURA: "Leitura", ESCRITA: "Escrita" };

export function ResumoRegra({ conteudo: c }: { conteudo: ConteudoRegra }) {
  return <div className="space-y-3">
    <h3 className="font-medium">{c.titulo}</h3><p className="whitespace-pre-wrap">{c.aplicacao}</p>
    <p>Escala: {c.escala.minimo} a {c.escala.maximo}. Mínimo geral: {c.minimoGeral}. Frequência mínima: {c.frequenciaMinimaPercentual}%.</p>
    <ul>{c.habilidades.map(h => <li key={h.habilidade}>{nomesHabilidades[h.habilidade]}: peso {h.peso}, mínimo {h.minimo}, limite de {h.limiteRecuperacoes} recuperações no nível da matrícula.</li>)}</ul>
    <h4 className="font-medium">Avaliações obrigatórias</h4>
    <ul className="space-y-2">{c.avaliacoes.map(a => <li key={a.codigo}>{a.codigo} — {a.titulo}: {a.etapa === "FINAL" ? "final" : "intermediária"}, peso {a.peso}; {a.habilidades.map(h => nomesHabilidades[h]).join(", ")}. Limite de {a.limiteSegundasChamadas} segundas chamadas desta avaliação.</li>)}</ul>
    <p>Recuperação: prazo de {c.recuperacao.prazoRealizacaoMinutos} minutos desde a disponibilização; cancelamento com antecedência de {c.recuperacao.antecedenciaCancelamentoMinutos} minutos libera a oportunidade.</p>
    <p>Segunda chamada: prazo de {c.segundaChamada.prazoRealizacaoMinutos} minutos desde a disponibilização; cancelamento com antecedência de {c.segundaChamada.antecedenciaCancelamentoMinutos} minutos libera a oportunidade.</p>
  </div>;
}
