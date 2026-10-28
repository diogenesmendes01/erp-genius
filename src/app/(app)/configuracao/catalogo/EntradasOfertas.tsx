"use client";

import { FormaAgendaOferta } from "@prisma/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { configurarEntradaOferta, consultarEntradasOfertas } from "@/server/catalogo/entrada-oferta";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { EstadoVazio } from "@/components/EstadoVazio";

import { CampoCombobox } from "@/components/ui/combobox";
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
    } catch { setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE); }
    finally { setPendente(false); }
  }}>
    <h3 className="font-medium">{oferta.produto.idioma.nome} · {oferta.produto.modalidade.nome} · {oferta.pais.nome}</h3>
    <p>{oferta.moeda} · Versão {oferta.versaoEntrada} · {oferta.oferecido ? "Ofertada" : "Não ofertada"}</p>
    <label className="block">Forma de agenda da oferta
      <CampoCombobox name="agenda" defaultValue={oferta.formaAgenda ?? ""} className="ml-2 rounded border p-2" vazio={"Ainda não conferida"} opcoes={[{ valor: "TURMA", rotulo: "Turma" }, { valor: "PARTICULAR_GRADE_FIXA", rotulo: "Particular com grade fixa" }, { valor: "PARTICULAR_FLEXIVEL", rotulo: "Particular com agenda flexível" }]} />
    </label>
    <p className="text-sm">Grade fixa exige reservar os horários recorrentes acordados; flexível exige ao menos o primeiro encontro. A contratação dessas particulares aguarda o fluxo de reserva individual.</p>
    <label className="block">Exigir taxa confirmada antes de liberar assinatura
      <CampoCombobox name="taxa" defaultValue={inicial(oferta.taxaPreviaAssinatura)} className="ml-2 rounded border p-2" required vazio={"Selecione"} opcoes={[{ valor: "sim", rotulo: "Exigir" }, { valor: "nao", rotulo: "Dispensar pagamento prévio à assinatura" }]} />
    </label>
    <label className="block">Adiantamento para ativar particulares por hora
      <CampoCombobox name="hora" defaultValue={inicial(oferta.adiantamentoHoraExigido)} className="ml-2 rounded border p-2" vazio={"Ainda não definido"} opcoes={[{ valor: "sim", rotulo: "Exigir" }, { valor: "nao", rotulo: "Dispensar" }]} />
    </label>
    <label className="block">Motivo da configuração <input name="motivo" required minLength={5} maxLength={2000} className="rounded border p-2" /></label>
    {erro && <p role="alert">{erro}</p>}
    <button type="submit" disabled={pendente} className={botaoClasses({ variante: "secundario", tamanho: "md" })}>{pendente ? "Salvando…" : "Salvar regras da oferta"}</button>
  </form>;
}
export function EntradasOfertas({ ofertas }: { ofertas: Oferta[] }) {
  return <section className="space-y-4"><h2 className="text-lg font-medium">Regras de entrada por oferta</h2>
    <p>Dispensar taxa antes da assinatura não dispensa seu pagamento para ativar. O adiantamento por hora terá valor e horas explicitados no contrato. Alterações valem para novas preparações; condições já registradas precisam de revisão própria.</p>
    {ofertas.map((o) => <Formulario key={`${o.id}:${o.versaoEntrada}`} oferta={o} />)}
    {!ofertas.length && <EstadoVazio>Cadastre a oferta do produto no país para configurar sua entrada.</EstadoVazio>}
  </section>;
}
