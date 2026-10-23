import { PrismaClient } from "@prisma/client";
import { PREFIXO_ID } from "./seed-qa-comum";

// Remove TODOS os dados gravados por prisma/seed-qa-dados.ts (ids iniciados por "qa_") e o que foi criado em cima
// deles durante os testes (linhas que apontam para um registro qa_). Ver README §"Base de QA".
//
//   QA_CLEANUP_CONFIRMAR=sim npx tsx prisma/cleanup-qa.ts
//
// Como funciona:
//   - roda numa única transação com `session_replication_role = replica`: os triggers de imutabilidade (recebimentos,
//     destinações, calendário escolar, histórico de mensagens) e as FKs ficam suspensos SÓ nesta transação, porque
//     esses registros, por regra de negócio, não podem ser apagados pelo app. Exige usuário dono/superusuário do banco;
//   - percorre todas as tabelas: linha com id `qa_` é apagada; linha real com FK para `qa_` tem a coluna zerada se
//     ela aceitar NULL, ou é apagada se não aceitar (ex.: presença lançada numa aula de QA);
//   - repete até não sobrar referência, e só então faz COMMIT.
// Não mexe: usuários de prisma/seed-qa.ts (@genius.com), contadores de código, preços de referência já existentes
// que o seed atualizou para a tabela oficial e o estado SHADOW das réguas.

const prisma = new PrismaClient();
const LIKE = `${PREFIXO_ID.replace(/_/g, "\\_")}%`;

type Coluna = { tabela: string; coluna: string; nula: boolean };

async function main() {
  if (process.env.QA_CLEANUP_CONFIRMAR !== "sim") {
    throw new Error('Defina QA_CLEANUP_CONFIRMAR=sim para apagar os dados de QA. Nada foi alterado.');
  }
  const resultado = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
      const comId = await tx.$queryRawUnsafe<{ tabela: string }[]>(
        `SELECT table_name AS tabela FROM information_schema.columns
          WHERE table_schema = current_schema() AND column_name = 'id' AND data_type = 'text'`,
      );
      const fks = await tx.$queryRawUnsafe<Coluna[]>(
        `SELECT c.relname AS tabela, a.attname AS coluna, NOT a.attnotnull AS nula
           FROM pg_constraint k
           JOIN pg_class c ON c.oid = k.conrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = current_schema()
           JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
          WHERE k.contype = 'f' AND array_length(k.conkey, 1) = 1`,
      );
      const totais: Record<string, number> = {};
      const soma = (t: string, n: number) => { if (n) totais[t] = (totais[t] ?? 0) + n; return n; };
      for (let rodada = 1; rodada <= 10; rodada++) {
        let mexeu = 0;
        for (const { tabela } of comId) {
          mexeu += soma(tabela, await tx.$executeRawUnsafe(`DELETE FROM "${tabela}" WHERE id LIKE $1`, LIKE));
        }
        for (const fk of fks) {
          const sql = fk.nula
            ? `UPDATE "${fk.tabela}" SET "${fk.coluna}" = NULL WHERE "${fk.coluna}" LIKE $1`
            : `DELETE FROM "${fk.tabela}" WHERE "${fk.coluna}" LIKE $1`;
          mexeu += soma(`${fk.tabela}.${fk.coluna}${fk.nula ? " (nulificado)" : ""}`, await tx.$executeRawUnsafe(sql, LIKE));
        }
        if (!mexeu) return totais;
      }
      throw new Error("Referências a dados de QA não convergiram em 10 rodadas; transação desfeita.");
    },
    { timeout: 600_000, maxWait: 30_000 },
  );
  console.log("Cleanup de QA concluído (linhas removidas/ajustadas por tabela):");
  for (const [t, n] of Object.entries(resultado).sort()) console.log(`  ${t.padEnd(50)} ${n}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
