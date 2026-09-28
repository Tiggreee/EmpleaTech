-- Con qué CV y respuestas se calculó el puntaje de cada vacante; si cambian, se vuelve a puntuar al leer.
alter table vacantes add column if not exists huella text;
