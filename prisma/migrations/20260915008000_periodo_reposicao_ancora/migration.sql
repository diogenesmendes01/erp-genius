-- Q49: cada fronteira mensal deriva da referência original, sem deslocamento após fevereiro.
CREATE OR REPLACE FUNCTION periodo_beneficio_reposicao(data_agendada DATE, beneficio "BeneficioReposicaoParticularMatricula") RETURNS TABLE(inicio DATE, fim DATE) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE duracao INTEGER; base DATE; blocos INTEGER;
BEGIN
  duracao := beneficio."duracaoPeriodo";
  IF beneficio.unidade='DIAS' THEN
    IF beneficio.referencia='CIVIL' THEN base := date '2000-01-01' + (floor((data_agendada-date '2000-01-01')::numeric/duracao)::integer*duracao); ELSE IF data_agendada<beneficio."referenciaCiclo" THEN RAISE EXCEPTION 'Data anterior ao ciclo do benefício'; END IF; base := beneficio."referenciaCiclo" + (floor((data_agendada-beneficio."referenciaCiclo")::numeric/duracao)::integer*duracao); END IF;
    inicio:=base; fim:=base+duracao; RETURN NEXT; RETURN;
  END IF;
  IF beneficio.referencia='CIVIL' THEN
    blocos := floor(((extract(year from data_agendada)::integer-2000)*12 + extract(month from data_agendada)::integer-1)::numeric/duracao);
    base := (date '2000-01-01' + make_interval(months => blocos*duracao))::date;
  ELSE
    IF data_agendada < beneficio."referenciaCiclo" THEN RAISE EXCEPTION 'Data anterior ao ciclo do benefício'; END IF;
    blocos := floor(((extract(year from data_agendada)::integer-extract(year from beneficio."referenciaCiclo")::integer)*12 + extract(month from data_agendada)::integer-extract(month from beneficio."referenciaCiclo")::integer)::numeric/duracao);
    base := (beneficio."referenciaCiclo" + make_interval(months => blocos*duracao))::date;
    IF base > data_agendada THEN blocos := blocos-1; base := (beneficio."referenciaCiclo" + make_interval(months => blocos*duracao))::date; END IF;
  END IF;
  inicio:=base;
  IF beneficio.referencia='CIVIL' THEN
    fim:=(date '2000-01-01' + make_interval(months => (blocos+1)*duracao))::date;
  ELSE
    fim:=(beneficio."referenciaCiclo" + make_interval(months => (blocos+1)*duracao))::date;
  END IF;
  RETURN NEXT;
END $$;

