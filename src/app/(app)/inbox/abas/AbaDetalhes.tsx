import {formatarDataCivil} from "@/lib/data-civil";
import { IconBriefcase, IconBuilding, IconCheck, IconChevronRight, IconId, IconLink, IconMail, IconMapPin, IconPhone, IconSchool, IconSpeakerphone, IconUser, IconUsers } from "@tabler/icons-react";
import { formatarMoedaOuIndefinida } from "@/lib/dinheiro";
import { ETAPA_LABEL, ORIGEM_CANAL_LABEL } from "@/lib/labels";
import type { CampoPainel, DetalhesPainel } from "@/server/inbox/painel-detalhes";
import type { CapacidadesPainel } from "@/server/inbox/permissoes";
import { Botao } from "@/components/Botao";
import { LinhaCampo } from "../LinhaCampo";
import { BlocoB2B } from "./BlocoB2B";

function valorDoCampo(campo: CampoPainel): string {
  const v = campo.valor;
  if (v === null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (campo.tipo === "DATA" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split("-").reverse().join("/");
  return String(v);
}

export function AbaDetalhes({ dados, capacidades, aoAbrirOportunidades }: { dados: DetalhesPainel; capacidades: Pick<CapacidadesPainel, "verContato" | "verEmpresa">; aoAbrirOportunidades?(): void }) {
  const { pessoa, oportunidade, b2b, campos } = dados;
  const empresa = pessoa?.empresa;
  const resumo = oportunidade && <>
    <IconBriefcase size={16} className="shrink-0 text-brand-700" aria-hidden="true" />
    <span className="flex min-w-0 flex-1 flex-col gap-px leading-[1.35] [overflow-wrap:anywhere]">
      <span className="text-[11.5px] text-gray-600">Oportunidade atual</span>
      <span className="text-[13px] font-medium">{oportunidade.produto ?? oportunidade.titulo} · {oportunidade.valor === null ? "Sem valor" : formatarMoedaOuIndefinida(oportunidade.valor, oportunidade.moeda)} · {ETAPA_LABEL[oportunidade.etapa]}</span>
    </span>
    <IconChevronRight size={14} className="shrink-0 text-gray-600" aria-hidden="true" />
  </>;
  const classeCartao = "flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-[10px] border border-gray-200 bg-surface-muted p-3 text-left hover:border-brand-solid";
  return <div className="flex min-w-0 flex-col gap-5">
    {oportunidade ? aoAbrirOportunidades ? <Botao variante="neutro" tamanho="md" aria-label="Abrir oportunidade atual" onClick={aoAbrirOportunidades} className={classeCartao}>{resumo}</Botao> : <a href={`/funil?o=${encodeURIComponent(oportunidade.id)}`} className={classeCartao}>{resumo}</a> : <p className="text-sm text-gray-600">Sem oportunidade visível para você.</p>}
    {!pessoa ? oportunidade && <p className="text-sm text-gray-600">Sem dados de contato para esta oportunidade.</p> : <>
      {b2b && <BlocoB2B bloco={b2b} verEmpresa={capacidades.verEmpresa} />}
      <section aria-label="Contato">
        <LinhaCampo icone={<IconPhone size={18} />} valor={<span className="font-mono">{pessoa.telefone ?? "—"}</span>} rotulo="WhatsApp" />
        <LinhaCampo icone={<IconMail size={18} />} valor={pessoa.email ?? "—"} rotulo="E-mail" />
        <LinhaCampo icone={<IconMapPin size={18} />} valor={b2b ? empresa?.segmentoMercado ?? "—" : pessoa.cidade ?? "—"} rotulo={b2b ? "Segmento" : "Cidade"} />
        <LinhaCampo icone={<IconSpeakerphone size={18} />} valor={pessoa.origemCanal ? ORIGEM_CANAL_LABEL[pessoa.origemCanal] : "—"} rotulo="Origem do contato" />
      </section>
      {dados.cadastroPessoa&&dados.informacoesCadastro&&<section aria-label="Cadastro pessoal">
        <LinhaCampo icone={<IconId size={18}/>} rotulo="Documento pessoal" valor={dados.cadastroPessoa.documento??"—"}/>
        <LinhaCampo icone={<IconId size={18}/>} rotulo="Tipo de documento" valor={dados.informacoesCadastro.documento?.tipoNome??"—"}/>
        <LinhaCampo icone={<IconMapPin size={18}/>} rotulo="País emissor" valor={dados.cadastroPessoa.documentoPaisEmissor??"—"}/>
        <LinhaCampo icone={<IconUser size={18}/>} rotulo="Nascimento" valor={formatarDataCivil(dados.cadastroPessoa.nascimento)}/>
        <LinhaCampo icone={<IconUser size={18}/>} rotulo="Idade" valor={dados.informacoesCadastro.idade===null?"—":`${dados.informacoesCadastro.idade} anos`}/>
        {dados.cadastroPessoa.documento&&!dados.informacoesCadastro.documento?.validado&&<p className="text-sm text-gray-600">Documento não validado. Confira o número e o tipo informado.</p>}
      </section>}
      <section aria-label={b2b ? "Empresa" : "Perfil"} className="-mx-[18px] border-t border-gray-200 px-[18px] pt-5">
        <h3 className="text-xs font-medium text-brand-700">{b2b ? "Empresa" : "Perfil"}</h3>
        {b2b && <>
          <LinhaCampo icone={<IconBuilding size={18} />} valor={empresa?.nome ?? b2b.empresa.nome} rotulo="Empresa" />
          <LinhaCampo icone={<IconUser size={18} />} valor={pessoa.cargo ?? "—"} rotulo="Cargo" />
          <LinhaCampo icone={<IconId size={18} />} valor={empresa?.documento ?? "—"} rotulo="Documento da empresa" />
          <LinhaCampo icone={<IconBuilding size={18} />} valor={empresa?.segmentoMercado ?? "—"} rotulo="Segmento" />
          <LinhaCampo icone={<IconUsers size={18} />} valor={empresa?.porte ?? "—"} rotulo="Tamanho" />
          <LinhaCampo icone={<IconLink size={18} />} valor={empresa?.site ?? pessoa.linkedin ?? "—"} rotulo="Site / LinkedIn" />
          <LinhaCampo icone={<IconCheck size={18} />} valor={b2b.decisor === null ? "—" : b2b.decisor ? "Sim" : "Não"} rotulo="Decisor?" />
        </>}
        {campos.map(c => <LinhaCampo key={c.id} icone={<IconSchool size={18} />} valor={valorDoCampo(c)} rotulo={c.nome} ia={c.ia} />)}
      </section>
      {capacidades.verContato && <a href={`/contatos?c=${encodeURIComponent(pessoa.id)}`} className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700 underline-offset-4 hover:underline">Abrir ficha completa</a>}
    </>}
  </div>;
}
