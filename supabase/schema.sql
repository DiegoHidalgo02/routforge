-- RoutForge — schema della sincronizzazione (MECC §25; T-033; D-SYNC-1, D-SYNC-2, D-SYNC-3; piano docs/piani/T-033.md §3).
-- La specifica eseguibile di queste regole è il servizio in memoria `src/platform/syncMemory.ts` (testato nel gate).
--
-- Da incollare nell'editor SQL del progetto Supabase, dopo questi passi:
--   1. Crea il progetto. Authentication → Sign In / Providers → Email: attivo.
--   2. Authentication → Emails → «Magic Link»: nel testo metti il codice {{ .Token }} (l'app chiede il codice di
--      6 cifre, non il collegamento). Il servizio email incluso ha un limite basso di invii: per l'uso quotidiano
--      conviene un SMTP proprio (Authentication → Emails → SMTP).
--   3. Authentication → Users → «Add user»: crea il tuo utente con la tua email; poi Authentication → Sign In /
--      Providers: spegni «Allow new users to sign up». URL e chiave anonima finiscono nell'app (sono pubblici per
--      costruzione): senza questo passo chiunque potrebbe crearsi un account e riempire lo spazio del progetto.
--   4. In `.env.local` (mai nel repository): VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (Project Settings → API).
-- La chiave `service_role` non va mai nell'app. Nessuna Edge Function.

-- Dispositivi: uno per sessione dell'accesso (`session_id` del JWT). `revoked_at` è monotono: si segna solo con
-- `revoke_device`, mai si azzera.
create table if not exists public.devices (
  session_id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  nome text not null,
  piattaforma text not null,
  ultima_attivita timestamptz,
  revoked_at timestamptz
);

-- Una busta per record sincronizzato (D-SYNC-1). `updated_at`/`deleted_at` in epoch ms come nell'app; `seq` è il
-- cursore del pull (un `received_at` uguale per tutto un lotto darebbe pareggi e salti).
create table if not exists public.records (
  user_id uuid not null references auth.users on delete cascade,
  tabella text not null,
  id text not null,
  dati jsonb not null,
  updated_at bigint not null,
  deleted_at bigint,
  generata boolean not null default false,
  device_id uuid not null,
  received_at timestamptz not null default clock_timestamp(),
  seq bigint generated always as identity,
  primary key (user_id, tabella, id),
  -- Un record dell'app sta ben sotto 1 MB: una riga più grande è un abuso
  check (octet_length(dati::text) <= 1048576)
);
create index if not exists records_user_seq on public.records (user_id, seq);

-- Il dispositivo della richiesta è dell'utente e non è revocato.
create or replace function public.device_active() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.devices d
    where d.session_id = (auth.jwt() ->> 'session_id')::uuid
      and d.user_id = auth.uid()
      and d.revoked_at is null
  );
$$;

alter table public.records enable row level security;
alter table public.devices enable row level security;

drop policy if exists records_select on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;
create policy records_select on public.records for select
  using (user_id = auth.uid() and public.device_active());
create policy records_insert on public.records for insert
  with check (user_id = auth.uid() and public.device_active() and device_id = (auth.jwt() ->> 'session_id')::uuid);
create policy records_update on public.records for update
  using (user_id = auth.uid() and public.device_active())
  with check (user_id = auth.uid() and device_id = (auth.jwt() ->> 'session_id')::uuid);
-- Le scritture passano solo da push_records, che applica elenco, istante e «ultimo vince»; la delete serve a «Cancella i
-- dati remoti»
grant select, delete on public.records to authenticated;
revoke insert, update on public.records from authenticated;
grant select, insert on public.devices to authenticated;
create policy records_delete on public.records for delete
  using (user_id = auth.uid() and public.device_active());

drop policy if exists devices_select on public.devices;
drop policy if exists devices_insert on public.devices;
drop policy if exists devices_update on public.devices;
create policy devices_select on public.devices for select using (user_id = auth.uid());
create policy devices_insert on public.devices for insert with check (
  user_id = auth.uid() and session_id = (auth.jwt() ->> 'session_id')::uuid and revoked_at is null
);
-- Solo la propria riga non revocata, e solo l'ultima attività (nome e piattaforma non si cambiano; la revoca no)
create policy devices_update on public.devices for update
  using (user_id = auth.uid() and session_id = (auth.jwt() ->> 'session_id')::uuid and revoked_at is null)
  with check (user_id = auth.uid() and session_id = (auth.jwt() ->> 'session_id')::uuid and revoked_at is null);
revoke update on public.devices from authenticated;
grant update (ultima_attivita) on public.devices to authenticated;
-- Nessuna delete sui dispositivi: «Scollega» passa da revoke_device

-- Come `attivo()` del servizio in memoria: un dispositivo revocato riceve l'errore che l'app traduce in «scollegato»;
-- uno non ancora registrato (un'altra scheda che parte prima della registrazione) un errore da ritentare.
create or replace function public.assert_device() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.devices d
    where d.session_id = (auth.jwt() ->> 'session_id')::uuid and d.user_id = auth.uid()
  ) then
    raise exception 'dispositivo_sconosciuto' using errcode = 'P0001';
  end if;
  if not public.device_active() then
    raise exception 'dispositivo_revocato' using errcode = 'P0001';
  end if;
  update public.devices set ultima_attivita = now()
  where session_id = (auth.jwt() ->> 'session_id')::uuid and user_id = auth.uid();
end;
$$;

-- Le buste degli altri dispositivi dopo il cursore, in ordine. Le righe ricevute negli ultimi 5 s aspettano il pull
-- successivo: un push ancora aperto con un `seq` minore non resta indietro per sempre.
-- ponytail: finestra di 5 s; se i push diventano lunghi, cursore sugli id di transazione (pg_snapshot_xmin).
create or replace function public.pull_records(p_da bigint, p_limite int)
returns setof public.records
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.assert_device();
  return query
    select * from public.records r
    where r.user_id = auth.uid()
      and r.seq > p_da
      and r.device_id <> (auth.jwt() ->> 'session_id')::uuid
      and r.received_at < now() - interval '5 seconds'
    order by r.seq
    limit least(greatest(p_limite, 1), 1000);
end;
$$;

-- «Ultimo vince» per record (D-SYNC-1, D-SYNC-2; `serverAccepts` nel dominio): una riga `generata` memorizzata cede a
-- tutto, una `generata` in arrivo non sovrascrive; altrimenti la più recente e, a parità, il dispositivo maggiore.
-- L'istante si ferma a 5 minuti dopo l'ora del servizio. Solo le tabelle e le preferenze dell'ambito (la chiave AI mai,
-- D-SYNC-3): una riga fuori elenco si scarta anche se un client la manda.
-- security definer: senza insert né update diretti su records, solo questa funzione scrive; mette lei utente e
-- dispositivo dal JWT e controlla il dispositivo, quindi non scavalca l'isolamento fra utenti.
create or replace function public.push_records(p_righe jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_ora bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_dispositivo uuid := (auth.jwt() ->> 'session_id')::uuid;
begin
  perform public.assert_device();
  insert into public.records as r (user_id, tabella, id, dati, updated_at, deleted_at, generata, device_id)
  select auth.uid(), e.tabella, e.id, e.dati, least(e.updated_at, v_ora + 300000), e.deleted_at,
         coalesce(e.generata, false), v_dispositivo
  from jsonb_to_recordset(p_righe)
    as e(tabella text, id text, dati jsonb, updated_at bigint, deleted_at bigint, generata boolean)
  where e.updated_at is not null
    and e.dati ->> 'id' = e.id
    and (e.tabella in ('ricorrenze', 'blocchi', 'logFasi')
         or (e.tabella = 'preferenze' and e.id in ('impostazioni', 'notifiche', 'profilo')))
  on conflict (user_id, tabella, id) do update set
    dati = excluded.dati,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    generata = excluded.generata,
    device_id = excluded.device_id,
    received_at = clock_timestamp(),
    seq = default
  where r.generata
     or (not excluded.generata
         and (excluded.updated_at > r.updated_at
              or (excluded.updated_at = r.updated_at and excluded.device_id > r.device_id)));
  -- Dove la riga in arrivo (valida come per l'insert) ha perso, la memorizzata, di un altro dispositivo, prende un `seq`
  -- nuovo e torna col prossimo pull a chi ha spedito, che si allinea invece di tenere la sua versione (D-SYNC-6)
  update public.records r set received_at = clock_timestamp(), seq = default
  from jsonb_to_recordset(p_righe) as e(tabella text, id text, dati jsonb, updated_at bigint)
  where r.user_id = auth.uid() and r.tabella = e.tabella and r.id = e.id and r.device_id <> v_dispositivo
    and e.updated_at is not null and e.dati ->> 'id' = e.id;
end;
$$;

-- «Scollega» (e la parte remota di «Esci»): il dispositivo resta in elenco come revocato e la sua sessione finisce.
create or replace function public.revoke_device(p_session uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Solo un dispositivo ancora attivo può scollegare (il token di uno revocato vale fino alla scadenza)
  perform public.assert_device();
  update public.devices set revoked_at = coalesce(revoked_at, now())
  where session_id = p_session and user_id = auth.uid();
  delete from auth.sessions where id = p_session and user_id = auth.uid();
end;
$$;

revoke all on function public.device_active() from public, anon;
revoke all on function public.assert_device() from public, anon;
revoke all on function public.pull_records(bigint, int) from public, anon;
revoke all on function public.push_records(jsonb) from public, anon;
revoke all on function public.revoke_device(uuid) from public, anon;
grant execute on function public.device_active() to authenticated;
grant execute on function public.assert_device() to authenticated;
grant execute on function public.pull_records(bigint, int) to authenticated;
grant execute on function public.push_records(jsonb) to authenticated;
grant execute on function public.revoke_device(uuid) to authenticated;
