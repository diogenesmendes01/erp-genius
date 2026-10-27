import { rodarReconciliacaoAcessoVencimento } from "@/server/contratos/vencimento-acesso";
import { iniciarTurmasDaAgenda } from "@/server/agenda/inicio-turmas";
import { rodarVencimentoParticulares } from "@/server/matricula/reserva-particular-cron";
import { NextResponse } from "next/server";
import { rodarCronRegua } from "@/server/whatsapp/cron";
import { drenarEventosMotor } from "@/server/whatsapp/motor/drenar";
import { despacharFila } from "@/server/whatsapp/despachante";
import { adotarMensagensOrfasDaLinha } from "@/server/whatsapp/linha-comercial";
import { rodarControleAcessoAulas } from "@/server/cobrancas/acesso-aulas";
import { rodarFechamentoComissoes } from "@/server/financeiro/cron-financeiro";
import { rodarFechamentosPendentes } from "@/server/matricula/cron-fechamento";
import { rodarLembretesTarefas } from "@/server/crm/lembretes";
import { rodarRecorrenciasTarefas } from "@/server/crm/tarefa-recorrencia-materializacao";
import { rodarAlertasSla } from "@/server/whatsapp/alertas-sla";
import { reprocessarTurnosPendentes } from "@/server/aria/turno/orquestrador";
import { expirarSugestoesAria } from "@/server/aria/expiracao";

export const runtime = "nodejs";

async function seguro<T>(rotulo: string, fn: () => Promise<T>): Promise<T | { erro: string }> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[cron ${rotulo}] falhou:`, e);
    return { erro: e instanceof Error ? e.message : "erro inesperado" };
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ erro: "CRON_SECRET não configurado." }, { status: 503 });
  if (req.headers.get("x-cron-secret") !== segredo) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const agora = new Date();
  const reservasParticulares = await seguro("reservas_particulares", () => rodarVencimentoParticulares());
  const inicioTurmas = await seguro("inicio_turmas", () => iniciarTurmasDaAgenda(agora));
  const acessoVencimentos = await seguro("acesso_vencimentos", () => rodarReconciliacaoAcessoVencimento());
  const acessoAulas = await seguro("acesso_aulas", () => rodarControleAcessoAulas(agora));
  const cobranca = await seguro("cobranca", () => rodarCronRegua(agora));
  const comissoes = await seguro("fechamento_comissoes", () => rodarFechamentoComissoes(agora));
  const fechamentosPendentes = await seguro("fechamentos_pendentes", () => rodarFechamentosPendentes());
  const linhaComercial = await seguro("linha_comercial_orfas", () => adotarMensagensOrfasDaLinha());
  const eventosMotor = await seguro("eventos_motor", () => drenarEventosMotor(agora));
  const recorrenciasTarefas = await seguro("recorrencias_tarefas", () => rodarRecorrenciasTarefas());
  const lembretesTarefas = await seguro("lembretes_tarefas", () => rodarLembretesTarefas(agora));
  const alertasSla = await seguro("alertas_sla", () => rodarAlertasSla(agora));
  const aria = await seguro("aria", () => reprocessarTurnosPendentes(agora));
  const ariaExpiracao = await seguro("aria-expiracao", () => expirarSugestoesAria(agora));
  const despacho = await seguro("despacho", () => despacharFila(agora));

  return NextResponse.json({
    reservasParticulares,
    inicioTurmas,
    acessoVencimentos,
    acessoAulas,
    cobranca,
    comissoes,
    fechamentosPendentes,
    linhaComercial,
    eventosMotor,
    recorrenciasTarefas,
    lembretesTarefas,
    alertasSla,
    aria,
    ariaExpiracao,
    despacho,
  });
}
