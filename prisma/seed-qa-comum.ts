// Utilidades compartilhadas por prisma/seed-qa-dados.ts e prisma/cleanup-qa.ts.
//
// Convenção de marcação (ver README §"Base de QA"):
//   - todo registro gravado pelo seed de dados de QA tem `id` iniciado por PREFIXO_ID ("qa_"): é a chave natural do
//     upsert (idempotência) e o filtro do cleanup;
//   - todo registro INVENTADO também leva "QA-" no nome/título visível, e e-mails/telefones fictícios
//     (@qa.geniusidiomas.test, +5060000xxxx) para nunca alcançar uma pessoa real;
//   - registros vindos das planilhas (dados reais) mantêm o nome real e só levam o prefixo no `id`.

export const PREFIXO_ID = "qa_";
export const PREFIXO_NOME = "QA-";
export const DOMINIO_EMAIL_QA = "qa.geniusidiomas.test";

/** id determinístico: `qa_<entidade>_<chave>` (só [a-z0-9_-]). */
export function qaId(entidade: string, chave: string | number): string {
  const limpa = String(chave)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${PREFIXO_ID}${entidade}_${limpa}`;
}

export const filtroQa = { id: { startsWith: PREFIXO_ID } } as const;
