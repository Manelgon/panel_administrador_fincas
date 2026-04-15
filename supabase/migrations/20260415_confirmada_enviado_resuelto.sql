-- Las reuniones que ya fueron enviadas o resueltas deben tener confirmada = TRUE,
-- ya que no pueden haber llegado a ese estado sin haber sido confirmadas antes.
UPDATE public.reuniones
  SET confirmada = TRUE
  WHERE enviado = TRUE
     OR resuelto = TRUE;
