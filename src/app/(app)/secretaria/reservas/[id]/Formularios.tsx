"use client";
import { useRef, useState } from "react";
import { instanteDaGrade } from "@/server/agenda/grade";
import { useRouter } from "next/navigation";
import { prepararResolucaoParticular, decidirResolucaoParticular } from "@/server/matricula/reserva-particular-resolucao";
import { prepararResolucaoReserva, decidirResolucaoReserva } from "@/server/matricula/reserva-resolucao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";
export function PrepararResolucao({ reservaId, versao, fuso, particular = false }: { reservaId: string; versao: number; fuso: string; particular?: boolean }) {
  const router = useRouter(), chave = useRef<string | null>(null);
  const [tipo, setTipo] = useState<"PRORROGAR" | "LIBERAR">("PRORROGAR");
  // A chave é a mesma entre tentativas e o servidor devolve a proposta existente quando ela se repete:
  // na falha de transporte, reenviar sem alterar é seguro (MSG_RESULTADO_INCERTO).
  const acao = useAcaoCliente({ idempotente: true }); const ocupado = acao.ocupado;
  return <form className="space-y-3 rounded border p-4" onSubmit={async (e) => { e.preventDefault(); const dados = new FormData(e.currentTarget);
    let novoPrazo: string | undefined;
    // Prazo conferido aqui, antes da action: horário inexistente ou ambíguo no fuso é erro de preenchimento.
    try { novoPrazo = tipo === "PRORROGAR" ? instanteDaGrade(String(dados.get("data")), String(dados.get("horario")), fuso).toISOString() : undefined; }
    catch (erro) { acao.limpar(); acao.setErro(erro instanceof Error ? erro.message : "Confira a data e o horário do novo prazo."); return; }
    chave.current ??= crypto.randomUUID(); const chaveIdempotencia = chave.current;
    const d = await acao.executar(async (): Promise<Resultado<unknown>> => (particular ? prepararResolucaoParticular : prepararResolucaoReserva)({ reservaId, versaoAnterior: versao, tipo,
      ...(novoPrazo !== undefined ? { novoPrazo } : {}), motivo: String(dados.get("motivo")), tratamentoContratacao: String(dados.get("tratamento")), chaveIdempotencia }), "Proposta enviada para revisão.");
    if (d?.tipo === "ok") router.refresh(); }}>
    <h2 className="font-medium">Preparar resolução</h2>
    <label className="block">Decisão proposta<select className="block rounded border p-2" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} disabled={ocupado}><option value="PRORROGAR">Prorrogar reserva</option><option value="LIBERAR">{particular ? "Liberar horários" : "Liberar vaga"}</option></select></label>
    {tipo === "PRORROGAR" && <div><p>Novo prazo no fuso {fuso}</p><label className="block">Data<input className="block rounded border p-2" type="date" name="data" required /></label><label className="block">Horário<input className="block rounded border p-2" type="time" name="horario" required /></label></div>}
    <label className="block">Motivo<CampoTexto className="block w-full rounded border p-2" name="motivo" required minLength={5} maxLength={2000} /></label>
    <label className="block">Tratamento previsto para contratação, documentos e valores<CampoTexto className="block w-full rounded border p-2" name="tratamento" required minLength={10} maxLength={4000} /></label>
    <p>A decisão da reserva não executa o tratamento financeiro ou documental. Esses processos conservam suas próprias aprovações.</p>
    <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado}>Enviar proposta para revisão</button><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
export function DecidirResolucao({ propostaId, podeAprovar, particular = false }: { propostaId: string; podeAprovar: boolean; particular?: boolean }) {
  const router = useRouter(); const [motivo, setMotivo] = useState("");
  // A decisão não recebe chave de idempotência; na falha de transporte vale a mensagem própria de decisão.
  const acao = useAcaoCliente({ idempotente: false }); const ocupado = acao.ocupado;
  async function decidir(aprovar: boolean) {
    const d = await acao.executar(async (): Promise<Resultado<unknown>> => (particular ? decidirResolucaoParticular : decidirResolucaoReserva)({ propostaId, aprovar, motivo }), aprovar ? "Proposta aprovada e aplicada." : "Proposta rejeitada.");
    if (d?.tipo === "incerto") acao.setErro(MSG_DECISAO_INCERTA);
    if (d?.tipo === "ok") router.refresh();
  }
  return <div className="space-y-2"><label className="block">Motivo da decisão<CampoTexto className="block w-full rounded border p-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={2000} /></label>
    <div className="flex gap-3"><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado || motivo.trim().length < 5 || !podeAprovar} onClick={() => decidir(true)}>Aprovar e aplicar</button><button className={botaoClasses({ variante: "perigo", tamanho: "lg" })} disabled={ocupado || motivo.trim().length < 5} onClick={() => decidir(false)}>Rejeitar proposta</button></div>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />{!podeAprovar && <p>A aprovação exige a proposta mais recente, estado conferido e prazo válido. Prepare uma nova proposta se necessário.</p>}
  </div>;
}
