// Busca disparada a cada tecla: as respostas podem chegar fora de ordem. Só a da busca mais recente
// vale — uma resposta de "an" que chega depois da de "ana" não pode sobrescrever as sugestões.
// `cancelar()` (no desmonte do componente) invalida a busca em voo, para ninguém gravar estado depois.

export type RespostaBusca<T> = { atual: true; valor: T } | { atual: false };

export function criarBuscaMaisRecente() {
  let seq = 0;
  return {
    async buscar<T>(consulta: () => Promise<T>): Promise<RespostaBusca<T>> {
      const minha = ++seq;
      const valor = await consulta();
      return minha === seq ? { atual: true, valor } : { atual: false };
    },
    /** Invalida qualquer busca em voo (ex.: o campo ficou curto demais, ou o componente saiu da tela). */
    cancelar() {
      seq++;
    },
  };
}
