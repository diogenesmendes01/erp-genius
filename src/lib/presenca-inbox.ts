export interface InscricaoPresencaInbox {
  id:string;geracao:number;confirmadaEm:number|null;ultimoContatoEm:number;
  ultimaInteracaoEm:number|null;desconectadaEm:number|null;
}
export type StatusPresencaInbox="online"|"ausente"|"offline";
export const AUSENCIA_INBOX_MS=600_000;
export const TOLERANCIA_INBOX_MS=60_000;
const instanteValido=(t:number,agora:number)=>Number.isFinite(t)&&t>=0&&t<=agora;
export function classificarPresencaInbox(inscricoes:readonly InscricaoPresencaInbox[],agora:number):StatusPresencaInbox {
  if(!Number.isFinite(agora)||agora<0)throw new RangeError("Instante do servidor inválido.");
  const atuais=new Map<string,InscricaoPresencaInbox>();
  for(const s of inscricoes){
    if(!s.id||!Number.isSafeInteger(s.geracao)||s.geracao<0)continue;
    const anterior=atuais.get(s.id);if(!anterior||s.geracao>anterior.geracao)atuais.set(s.id,s);
  }
  let viva=false;
  for(const s of atuais.values()){
    if(s.desconectadaEm!==null||s.confirmadaEm===null||!instanteValido(s.confirmadaEm,agora)||!instanteValido(s.ultimoContatoEm,agora)||s.ultimoContatoEm<s.confirmadaEm||agora-s.ultimoContatoEm>=TOLERANCIA_INBOX_MS)continue;
    viva=true;
    if(s.ultimaInteracaoEm!==null&&instanteValido(s.ultimaInteracaoEm,agora)&&agora-s.ultimaInteracaoEm<AUSENCIA_INBOX_MS)return "online";
  }
  return viva?"ausente":"offline";
}
export function encerrarInscricaoInbox(atual:InscricaoPresencaInbox,alvo:Pick<InscricaoPresencaInbox,"id"|"geracao">,agora:number):InscricaoPresencaInbox {
  if(atual.id!==alvo.id||atual.geracao!==alvo.geracao||atual.desconectadaEm!==null||!instanteValido(agora,agora)||agora<atual.ultimoContatoEm)return atual;
  return {...atual,desconectadaEm:agora};
}
