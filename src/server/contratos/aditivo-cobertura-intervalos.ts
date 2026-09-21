import { ErroRegra } from "@/server/_shared";

type Linha = {
  id: string;
  afetada: boolean;
  anterior: { inicio: string | null; fim: string | null };
  nova: { inicio: string | null; fim: string | null };
};
const seguinte = (data: string) => {
  const d = new Date(`${data}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** A proposta financeira resolve efeitos colaterais sem substituir os limites assinados. */
export function conferirIntervalosCoberturaAditivo(linhas: Linha[], formalizada: { inicio: string; fim: string }) {
  const ordenadas = [...linhas].filter(l => l.nova.inicio && l.nova.fim)
    .sort((a, b) => a.nova.inicio!.localeCompare(b.nova.inicio!) || a.id.localeCompare(b.id));
  for (let i = 0; i < ordenadas.length; i++) {
    const atual = ordenadas[i];
    for (const anterior of ordenadas.slice(0, i)) {
      if ((atual.afetada || anterior.afetada) && anterior.nova.fim! >= atual.nova.inicio!) {
        throw new ErroRegra("A correção cria sobreposição de intervalos de cobertura; resolva os impactos antes de aprovar.");
      }
    }
    const anterior = ordenadas[i - 1];
    if (anterior && (atual.afetada || anterior.afetada) && seguinte(anterior.nova.fim!) < atual.nova.inicio! &&
      (anterior.anterior.fim !== anterior.nova.fim || atual.anterior.inicio !== atual.nova.inicio)) {
      throw new ErroRegra("A correção cria uma lacuna entre intervalos de cobertura; resolva os impactos antes de aprovar.");
    }
  }
  if (!linhas.some(l => l.afetada && l.nova.inicio === formalizada.inicio && l.nova.fim === formalizada.fim)) {
    throw new ErroRegra("O conjunto não aplica a cobertura formalizada no aditivo assinado.");
  }
}
