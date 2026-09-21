"use client";

import { FormaAgendaOferta } from "@prisma/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { configurarEntradaOferta, consultarEntradasOfertas } from "@/server/catalogo/entrada-oferta";

type Oferta = Awaited<ReturnType<typeof consultarEntradasOfertas>>[number];
function Formulario({ oferta }: { oferta: Oferta }) {
  const router = useRouter(), [pendente, setPendente] = useState(false), [erro, setErro] = useState("");
  const inicial = (v: boolean | null) => v === null ? "" : v ? "sim" : "nao";
  return <form className="space-y-3 rounded border p-4" onSubmit={async (e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); setPendente(true); setErro("");
    try {
      const r = await configurarEntradaOferta({ ofertaId: oferta.id, versaoEsperada: oferta.versaoEntrada,
        formaAgenda: (String(f.get("agenda") ?? "") || null) as FormaAgendaOferta | null, taxaPreviaAssinatura: f.get("taxa") === "sim", adiantamentoHoraExigido: f.get("hora") === "" ? null : f.get("hora") === "sim", motivo: String(f.get("motivo") ?? "") });
      if (!r.ok) setErro(r.erro); else router.refresh();
    } catch { setErro("Não foi possível confirmar o resultado. Atualize a tela antes de tentar novamente."); }
    finally { setPendente(false); }
  }}>
    <h3 className="font-medium">{oferta.produto.idioma.nome} · {oferta.produto.modalidade.nome} · {oferta.pais.nome}</h3>
    <p>{oferta.moeda} · Versão {oferta.versaoEntrada} · {oferta.oferecido ? "Ofertada" : "Não ofertada"}</p>
    <label className="block">Forma de agenda da oferta
      <select name="agenda" defaultValue={oferta.formaAgenda ?? ""} className="ml-2 rounded border p-2">
        <option value="">Ainda não conferida</option><option value="TURMA">Turma</option>
        <option value="PARTICULAR_GRADE_FIXA">Particular com grade fixa</option><option value="PARTICULAR_FLEXIVEL">Particular com agenda flexível</option>
      </select>
    </label>
    <p className="text-sm">Grade fixa exige reservar os horários recorrentes acordados; flexível exige ao menos o primeiro encontro. A contratação dessas particulares aguarda o fluxo de reserva individual.</p>
    <label className="block">Exigir taxa confirmada antes de liberar assinatura
      <select name="taxa" required defaultValue={inicial(oferta.taxaPreviaAssinatura)} className="ml-2 rounded border p-2">
        <option value="">Selecione</option><option value="sim">Exigir</option><option value="nao">Dispensar pagamento prévio à assinatura</option>
      </select>
    </label>
    <label className="block">Adiantamento para ativar particulares por hora
      <select name="hora" defaultValue={inicial(oferta.adiantamentoHoraExigido)} className="ml-2 rounded border p-2">
        <option value="">Ainda não definido</option><option value="sim">Exigir</option><option value="nao">Dispensar</option>
      </select>
    </label>
    <label className="block">Motivo da configuração <input name="motivo" required minLength={5} maxLength={2000} className="rounded border p-2" /></label>
    {erro && <p role="alert">{erro}</p>}
    <button disabled={pendente} className="rounded border px-3 py-2">{pendente ? "Salvando…" : "Salvar regras da oferta"}</button>
  </form>;
}
export function EntradasOfertas({ ofertas }: { ofertas: Oferta[] }) {
  return <section className="space-y-4"><h2 className="text-lg font-semibold">Regras de entrada por oferta</h2>
    <p>Dispensar taxa antes da assinatura não dispensa seu pagamento para ativar. O adiantamento por hora terá valor e horas explicitados no contrato. Alterações valem para novas preparações; condições já registradas precisam de revisão própria.</p>
    {ofertas.map((o) => <Formulario key={`${o.id}:${o.versaoEntrada}`} oferta={o} />)}
    {!ofertas.length && <p>Cadastre a oferta do produto no país para configurar sua entrada.</p>}
  </section>;
}
