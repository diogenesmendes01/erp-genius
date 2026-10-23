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
//   - linhas criadas pelos serviços do ERP sobre dados de QA (ids cuid, ex.: matrícula, prévias, processos de
//     assinatura e aditivos de prisma/seed-qa-contratos.ts) são removidas pela varredura de órfãos: com as FKs
//     suspensas, toda linha cuja FK aponta para registro inexistente é apagada. Como as
//     FKs valem fora desta transação, só existem órfãos criados por ela;
//   - Eventos cujo agregado foi apagado nesta transação também saem;
//   - modelos contratuais importados pelo seed (códigos em MODELOS_QA) saem só se nenhum registro real os usar;
//   - repete até não sobrar referência, e só então faz COMMIT.
// Não mexe: usuários de prisma/seed-qa.ts (@genius.com), contadores de código, preços de referência já existentes
// que o seed atualizou para a tabela oficial, o estado SHADOW das réguas e a ConfiguracaoOperacional criada pelo
// seed de contratos quando a base não tinha nenhuma.

const prisma = new PrismaClient();
const LIKE = `${PREFIXO_ID.replace(/_/g, "\\_")}%`;

type Coluna = { tabela: string; coluna: string; nula: boolean; alvo: string; alvoColuna: string };
const MODELOS_QA = ["CONTRATO-CR", "CONTRATO-PA", "ADENDA-CR", "ADENDA-PA"];

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
        `SELECT c.relname AS tabela, a.attname AS coluna, NOT a.attnotnull AS nula, r.relname AS alvo, ra.attname AS "alvoColuna"
           FROM pg_constraint k
           JOIN pg_class c ON c.oid = k.conrelid
           JOIN pg_class r ON r.oid = k.confrelid
           JOIN pg_attribute ra ON ra.attrelid = k.confrelid AND ra.attnum = k.confkey[1]
           JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = current_schema()
           JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
          WHERE k.contype = 'f' AND array_length(k.conkey, 1) = 1`,
      );
      await tx.$executeRawUnsafe("CREATE TEMP TABLE qa_apagados (id text) ON COMMIT DROP");
      // Apaga e guarda os ids removidos (para limpar os Eventos desses agregados).
      const apagar = (tabela: string, where: string, ...p: unknown[]) => tx.$executeRawUnsafe(
        `WITH d AS (DELETE FROM "${tabela}" x WHERE ${where} RETURNING to_jsonb(x)->>'id' AS id) INSERT INTO qa_apagados SELECT id FROM d WHERE id IS NOT NULL`, ...p);
      const totais: Record<string, number> = {};
      const soma = (t: string, n: number) => { if (n) totais[t] = (totais[t] ?? 0) + n; return n; };
      for (let rodada = 1; rodada <= 10; rodada++) {
        let mexeu = 0;
        for (const { tabela } of comId) {
          mexeu += soma(tabela, await apagar(tabela, "x.id LIKE $1", LIKE));
        }
        for (const fk of fks) {
          const sql = fk.nula
            ? `UPDATE "${fk.tabela}" SET "${fk.coluna}" = NULL WHERE "${fk.coluna}" LIKE $1`
            : null;
          const n = sql ? await tx.$executeRawUnsafe(sql, LIKE) : await apagar(fk.tabela, `x."${fk.coluna}" LIKE $1`, LIKE);
          mexeu += soma(`${fk.tabela}.${fk.coluna}${fk.nula ? " (nulificado)" : ""}`, n);
        }
        // Órfãos: linhas cuja FK aponta para registro já apagado nesta transação.
        for (const fk of fks) {
          const orfao = `x."${fk.coluna}" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "${fk.alvo}" r WHERE r."${fk.alvoColuna}" = x."${fk.coluna}")`;
          // Órfão é sempre linha criada pelos serviços sobre dados de QA: apaga (nulificar pode violar CHECKs de origem).
          mexeu += soma(`${fk.tabela}.${fk.coluna} (órfão)`, await apagar(fk.tabela, orfao));
        }
        // Modelos contratuais importados pelo seed: só quando nada além da própria decisão os referencia.
        const refsModelo = fks.filter((f) => f.alvo === "VersaoModeloContratual" && f.tabela !== "DecisaoModeloContratual");
        const livre = refsModelo.map((f) => `NOT EXISTS (SELECT 1 FROM "${f.tabela}" y WHERE y."${f.coluna}" = x.id)`).join(" AND ") || "TRUE";
        mexeu += soma("VersaoModeloContratual (modelos QA)", await apagar("VersaoModeloContratual", `x.codigo = ANY($1::text[]) AND ${livre}`, MODELOS_QA));
        mexeu += soma("Evento (agregado apagado)", await tx.$executeRawUnsafe(`DELETE FROM "Evento" e USING qa_apagados a WHERE e."agregadoId" = a.id`));
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
