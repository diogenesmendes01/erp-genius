import { Client } from "pg";
/** Instrumentação exclusiva377. Cada SELECT do observador usa snapshot autocommit novo. */
export const pausa377=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
export async function esperarBloqueio377(observador:Client,holder:number,trecho:string,minimo=1) {
  const fim=Date.now()+4000;
  while(Date.now()<fim){
    const r=await observador.query<{pid:number;query:string;bloqueadores:number[]}>(
      `SELECT pid,query,pg_blocking_pids(pid) AS bloqueadores FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1`,['%'+trecho+'%']);
    const bloqueados=r.rows.filter(a=>a.bloqueadores.includes(holder));
    if(bloqueados.length>=minimo)return bloqueados;
    await pausa377(10);
  }
  throw new Error('Não houve espera SQL real comprovada377 em '+trecho);
}
export async function conexao377(){const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();return c;}
export async function holder377(tabela:"AtendimentoWhatsApp"|"GeracaoInsightInbox",id:string,modo:"UPDATE"|"KEY SHARE"="UPDATE") {
  const c=await conexao377();
  try {
    await c.query('BEGIN');
    const {rows}=await c.query<{pid:number}>('SELECT pg_backend_pid() AS pid');
    // Identificadores fechados acima; o ID continua parametrizado.
    await c.query(`SELECT id FROM "${tabela}" WHERE id=$1 FOR ${modo}`,[id]);
    return {c,pid:rows[0].pid};
  }catch(e){await c.query('ROLLBACK').catch(()=>{});await c.end();throw e;}
}
