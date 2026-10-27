export type RespostaBusca<T> = { atual: true; valor: T } | { atual: false };

export function criarBuscaMaisRecente() {
  let seq = 0;
  return {
    async buscar<T>(consulta: () => Promise<T>): Promise<RespostaBusca<T>> {
      const minha = ++seq;
      const valor = await consulta();
      return minha === seq ? { atual: true, valor } : { atual: false };
    },
    cancelar() {
      seq++;
    },
  };
}
