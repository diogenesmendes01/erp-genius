import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const agendarTriagemAria = vi.hoisted(() => vi.fn());
vi.mock("@/server/aria/triagem", () => ({ agendarTriagemAria }));
vi.mock("@/server/aria/turno/orquestrador", () => ({ agendarTurnoAria: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { truncarBanco } from "@/test/integracao";
import { processarMensagemNormalizada, type InboundNormalizado } from "./inbound";

// Gancho pós-commit da triagem da Aria: só quando a mensagem não ganhou atendimento e não é fromMe.

beforeEach(async () => {
  await truncarBanco();
  agendarTriagemAria.mockReset();
});

const base = (numero: string, id: string, extra: Partial<InboundNormalizado> = {}): InboundNormalizado => ({
  numeroTelefoneE164: numero, contatoWaId: "50688887777", providerMessageId: id, corpo: "preciso do boleto",
  tipo: "TEXTO", driver: "MOTOR", fromMe: false, quando: new Date(), ...extra,
});

describe("gancho agendarTriagemAria em inbound.ts", () => {
  it("numero_multissetor_sem_atendimento_agenda_a_triagem_com_o_id_da_mensagem", async () => {
    await criarNumeroSetor({ telefoneE164: "+5511900000555", setores: ["COMERCIAL", "FINANCEIRO"], finalidade: "COBRANCA" });
    expect(await processarMensagemNormalizada(base("+5511900000555", "w-1"))).toBe("gravada");
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow({ where: { providerMessageId: "w-1" } });
    expect(m.atendimentoId).toBeNull();
    expect(agendarTriagemAria).toHaveBeenCalledTimes(1);
    expect(agendarTriagemAria).toHaveBeenCalledWith(m.id);
  });

  it("mensagem_duplicada_nao_agenda_de_novo", async () => {
    await criarNumeroSetor({ telefoneE164: "+5511900000555", setores: ["COMERCIAL", "FINANCEIRO"], finalidade: "COBRANCA" });
    await processarMensagemNormalizada(base("+5511900000555", "w-1"));
    expect(await processarMensagemNormalizada(base("+5511900000555", "w-1"))).toBe("duplicada");
    expect(agendarTriagemAria).toHaveBeenCalledTimes(1);
  });

  it("fromMe_nao_agenda", async () => {
    await criarNumeroSetor({ telefoneE164: "+5511900000555", setores: ["COMERCIAL", "FINANCEIRO"], finalidade: "COBRANCA" });
    await processarMensagemNormalizada(base("+5511900000555", "w-2", { fromMe: true }));
    expect(agendarTriagemAria).not.toHaveBeenCalled();
  });

  it("numero_de_setor_unico_ja_tem_atendimento_e_nao_agenda", async () => {
    await criarNumeroSetor({ telefoneE164: "+5511900000888", setores: ["SECRETARIA"], finalidade: "COBRANCA" });
    await processarMensagemNormalizada(base("+5511900000888", "w-3"));
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow({ where: { providerMessageId: "w-3" } });
    expect(m.atendimentoId).not.toBeNull();
    expect(agendarTriagemAria).not.toHaveBeenCalled();
  });
});
