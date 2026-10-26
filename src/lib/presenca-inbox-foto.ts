/** Foto de presença usa validade relativa e relógio monotônico; não é autorização. */
export function restanteFotoPresenca(validadeMs:unknown,inicio:number,agora:number):number|null {
  if(typeof validadeMs!=="number"||!Number.isFinite(validadeMs)||validadeMs<=0||validadeMs>25000||!Number.isFinite(inicio)||!Number.isFinite(agora)||inicio<0||agora<inicio)return null;
  const restante=validadeMs-(agora-inicio);
  return restante>0?restante:null;
}
