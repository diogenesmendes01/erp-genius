"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { abrirAtendimentoInstitucional, type OpcoesAtendimento } from "@/server/whatsapp/operacoes-atendimento";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";

// abrirAtendimentoInstitucional (operacoes-atendimento.ts) recebe chave de idempotência (#166): o reenvio da
// mesma tentativa devolve o atendimento já aberto sem gravar outro Evento. A chave só muda depois do sucesso.

export function NovoAtendimento({ opcoes }: { opcoes: OpcoesAtendimento }) {
  const router = useRouter();
  const [destino, setDestino] = useState("");
  const [numero, setNumero] = useState("");
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();
  const destinoSelecionado = opcoes.destinos.find((item) => item.chave === destino);
  // SPEC-ERP-005 §5.5: assunto comercial sai só pelas linhas comerciais do usuário.
  const numeros = destinoSelecionado?.finalidade === "COMERCIAL" ? opcoes.numeros.filter((n) => n.comercial) : opcoes.numeros;
  const semLinha = destinoSelecionado?.finalidade === "COMERCIAL" && !numeros.length;
  return <div className="space-y-3">
    <form className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-surface p-3" onSubmit={async (e) => {
      e.preventDefault();
      const d = await acao.executar(() => abrirAtendimentoInstitucional({ destinoChave: destino, numeroId: numero, chaveIdempotencia: tentativa.atual }));
      tentativa.depoisDo(d);
      if (d?.tipo === "ok") { router.push(`/inbox?c=${d.dado!.id}`); }
    }}>
      <label className="grid min-w-0 max-w-full gap-1 text-sm">Finalidade e destinatário
        <select required value={destino} onChange={(e) => {
          const novo = opcoes.destinos.find((item) => item.chave === e.target.value);
          setDestino(e.target.value);
          // Canal escolhido que não serve ao novo assunto (ex.: cobrança para um lead) é limpo.
          if (novo?.finalidade === "COMERCIAL" && !opcoes.numeros.some((n) => n.id === numero && n.comercial)) setNumero("");
        }} aria-describedby={destinoSelecionado?.impedimento ? "impedimento-destino" : undefined} className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2">
          <option value="">Selecione o atendimento</option>
          {opcoes.destinos.map((d) => <option key={d.chave} value={d.chave} disabled={d.disponivel === false}>{d.nome}{d.disponivel === false ? " · indisponível" : ""}</option>)}
        </select>
      </label>
      <label className="grid min-w-0 max-w-full gap-1 text-sm">Canal da escola
        <select required value={numero} onChange={(e) => setNumero(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2">
          <option value="">Selecione o canal</option>
          {numeros.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
        </select>
      </label>
      <button disabled={acao.ocupado || !opcoes.destinos.length || !numeros.length} className={botaoClasses({ tamanho: "lg" })}>Abrir atendimento</button>
      {/* Sem destinatário no escopo o servidor nem lista canais: dizer "falta canal" aqui culpava a
          administração quando o que falta é o lead/aluno (ex.: vendedor sem lead na carteira). */}
      {!opcoes.destinos.length ? (
        <EstadoVazio>
          {opcoes.comercial
            ? "Nenhum lead na sua carteira para iniciar uma conversa. Cadastre o lead em Leads; as conversas que chegam na sua linha já aparecem na lista abaixo."
            : "Nenhum destinatário no seu escopo para abrir um atendimento agora. As conversas recebidas continuam na lista abaixo."}
        </EstadoVazio>
      ) : !opcoes.numeros.length && <EstadoVazio>A administração precisa disponibilizar um canal ativo para os atendimentos autorizados.</EstadoVazio>}
      {opcoes.numeros.length > 0 && semLinha && <EstadoVazio>Atendimento comercial sai pela sua linha comercial. Peça à administração para atribuir uma linha a você.</EstadoVazio>}
      {destinoSelecionado?.impedimento && <p id="impedimento-destino" role="status" className="basis-full text-xs text-amber-800">{destinoSelecionado.impedimento}</p>}
    </form>
    <FeedbackAcao erro={acao.erro} />
  </div>;
}
