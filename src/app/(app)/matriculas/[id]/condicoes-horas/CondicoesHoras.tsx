"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { consultarCondicoesHoras, prepararCondicoesHoras, decidirCondicoesHoras } from "@/server/matricula/condicoes-horas";
import { instanteDaGrade } from "@/server/agenda/grade";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { formatarMoeda, parseMoeda } from "@/lib/dinheiro";
import { CampoMoeda } from "@/components/CampoMoeda";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";
type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarCondicoesHoras>>, { ok: true }>["dado"]>;
export function CondicoesHoras({ dados: d, preferenciaFusoExibicao = null }: { dados: Dados; preferenciaFusoExibicao?: string | null }) {
  const router = useRouter(), [ocupado, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  const [valorHora, setValorHora] = useState("");
  const classe = "block w-full rounded border p-2";
  const instanteAdministrativo = (valor: string) => { const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC"); return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`; };
  const vigencia = (valor: string) => { const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, d.fuso ?? "UTC"); return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; referência contratual preservada)`; };
  return <div className="space-y-4">
    <p>Matrícula {d.codigo ?? d.matriculaId} · {d.moeda}</p>
    <MensagemStatus texto={d.impedimento} />
    <MensagemStatus texto={mensagem} />
    {d.podePreparar && d.documentoId && d.fuso && <form className="space-y-3 rounded border p-4" onSubmit={event => {
      event.preventDefault(); const f = new FormData(event.currentTarget);
      const valorHoraNumero = parseMoeda(valorHora);
      if (valorHoraNumero === null) { setMensagem("Informe o preço por hora, com no máximo duas casas decimais."); return; }
      iniciar(async () => {
        setMensagem("");
        try {
          const r = await prepararCondicoesHoras({ matriculaId: d.matriculaId, documentoId: d.documentoId!, motivo: String(f.get("motivo")), regras: {
            moeda: d.moeda, unidadeMinutos: 60, valorHora: valorHoraNumero.toFixed(2), antecedenciaCancelamentoMinutos: Number(f.get("antecedencia")),
            vigenteDesde: instanteDaGrade(String(f.get("data")), String(f.get("hora")), d.fuso!).toISOString(),
            clausulaPreco: String(f.get("preco")), clausulaCancelamento: String(f.get("cancelamento")),
          } });
          setMensagem(r.ok ? "Versão preparada para revisão independente." : r.erro); if (r.ok) router.refresh();
        } catch (e) { setMensagem(e instanceof Error ? e.message : MSG_RESULTADO_INCERTO_SEM_CHAVE); }
      });
    }}>
      <fieldset disabled={ocupado} className="space-y-3"><legend>Nova transcrição do contrato confirmado</legend>
        <label className="block">Preço por hora de 60 minutos ({d.moeda})<CampoMoeda className={classe} value={valorHora} onChange={setValorHora} moeda={d.moeda} required /></label>
        <label className="block">Antecedência de cancelamento, em minutos<input className={classe} name="antecedencia" type="number" min="0" max="5256000" step="1" required /></label>
        <p>Início de vigência conforme contrato · horário de {d.fuso}</p>
        <label className="block">Data<input className={classe} name="data" type="date" required /></label>
        <label className="block">Hora<input className={classe} name="hora" type="time" required /></label>
        <label className="block">Referência e condições da cláusula de preço<CampoTexto className={classe} name="preco" maxLength={2000} required /></label>
        <label className="block">Referência e condições da cláusula de cancelamento<CampoTexto className={classe} name="cancelamento" maxLength={2000} required /></label>
        <label className="block">Motivo da transcrição<CampoTexto className={classe} name="motivo" minLength={5} maxLength={2000} required /></label>
        <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Preparar para revisão"}</button>
      </fieldset>
    </form>}
    <h2 className="text-lg">Histórico das condições</h2>
    {!d.versoes.length && <EstadoVazio>Nenhuma versão registrada.</EstadoVazio>}
    {d.versoes.map(v => <article key={v.id} className="space-y-2 rounded border p-4">
      <h3>Versão {v.versao} · {v.status === "APROVADA" ? "Aprovada" : v.status === "REJEITADA" ? "Rejeitada" : "Aguardando revisão"}</h3>
      <p>{v.preparador.nome} · {instanteAdministrativo(v.criadaEm)} · Documento {v.documentoId}</p>
      {v.regras ? <><p>{formatarMoeda(v.regras.valorHora, v.regras.moeda)} por 60 minutos · Antecedência: {v.regras.antecedenciaCancelamentoMinutos} minutos</p>
        <p>Vigência desde {vigencia(v.regras.vigenteDesde)}</p>
        <p className="whitespace-pre-wrap">Preço: {v.regras.clausulaPreco}</p><p className="whitespace-pre-wrap">Cancelamento: {v.regras.clausulaCancelamento}</p></> : <p role="alert">Regras precisam de conferência.</p>}
      <p>{v.motivo}</p>{v.decisor && <p>Decisão de {v.decisor.nome}: {v.motivoDecisao}{v.decididaEm && ` · ${instanteAdministrativo(v.decididaEm)}`}</p>}
      {v.podeDecidir && <form className="space-y-2" onSubmit={event => {
        event.preventDefault(); const f = new FormData(event.currentTarget);
        iniciar(async () => {
          try { const r = await decidirCondicoesHoras({ id: v.id, aprovar: f.get("decisao") === "aprovar", motivo: String(f.get("motivo")) });
            setMensagem(r.ok ? "Decisão registrada." : r.erro); if (r.ok) router.refresh();
          } catch { setMensagem(MSG_DECISAO_INCERTA); }
        });
      }}><fieldset disabled={ocupado} className="space-y-2"><legend>Revisão administrativa</legend>
        <label className="block">Decisão<select className={classe} name="decisao" defaultValue="" required><option value="" disabled>Selecione</option><option value="aprovar">Aprovar transcrição</option><option value="rejeitar">Rejeitar transcrição</option></select></label>
        <label className="block">Justificativa<CampoTexto className={classe} name="motivo" minLength={5} maxLength={2000} required /></label>
        <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Registrar decisão</button>
      </fieldset></form>}
    </article>)}
  </div>;
}
