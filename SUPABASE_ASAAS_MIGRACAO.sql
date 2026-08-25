-- QRA FRETE - Integração Asaas / acesso anual
-- Execute uma única vez no SQL Editor do Supabase do projeto do QRA FRETE.

create table if not exists public.pagamentos_asaas_qra (
  checkout_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  external_reference text not null,
  valor numeric(10,2) not null,
  status text not null default 'ACTIVE',
  checkout_url text,
  evento_pago_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists pagamentos_asaas_qra_user_idx on public.pagamentos_asaas_qra(user_id);
create unique index if not exists pagamentos_asaas_qra_evento_pago_uidx
  on public.pagamentos_asaas_qra(evento_pago_id) where evento_pago_id is not null;

alter table public.pagamentos_asaas_qra enable row level security;
-- Sem policies públicas: somente o backend com SERVICE_ROLE acessa esta tabela.

create or replace function public.processar_checkout_asaas_qra(
  p_checkout_id text,
  p_event_id text,
  p_valor numeric
)
returns table(user_id uuid, acesso_ate timestamptz, idempotente boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pag public.pagamentos_asaas_qra%rowtype;
  v_atual timestamptz;
  v_novo timestamptz;
  v_evento_existente text;
begin
  if p_event_id is null or length(trim(p_event_id))=0 then
    raise exception 'Evento Asaas sem identificador';
  end if;

  select * into v_pag
  from public.pagamentos_asaas_qra
  where checkout_id=p_checkout_id
  for update;

  if not found then
    raise exception 'Checkout Asaas não reconhecido pelo QRA';
  end if;

  if abs(coalesce(p_valor,0)-v_pag.valor) > 0.009 then
    raise exception 'Valor recebido difere do pedido registrado';
  end if;

  select evento_pago_id into v_evento_existente
  from public.pagamentos_asaas_qra
  where evento_pago_id=p_event_id
  limit 1;

  if v_evento_existente is not null or v_pag.status='PAID' then
    select a.acesso_ate into v_novo from public.acessos_qra a where a.user_id=v_pag.user_id;
    return query select v_pag.user_id, v_novo, true;
    return;
  end if;

  select a.acesso_ate into v_atual
  from public.acessos_qra a
  where a.user_id=v_pag.user_id
  for update;

  v_novo := (case when v_atual is not null and v_atual > now() then v_atual else now() end) + interval '1 year';

  insert into public.acessos_qra(
    user_id,status,acesso_ate,origem,produto_id,purchase_token,order_id,observacao,atualizado_em
  ) values (
    v_pag.user_id,'ativo',v_novo,'asaas_web','qra_frete_12_meses',
    'asaas:'||p_checkout_id,p_checkout_id,'Acesso anual QRA FRETE — R$ 119,90 via Asaas',now()
  )
  on conflict (user_id) do update set
    status='ativo',
    acesso_ate=excluded.acesso_ate,
    origem='asaas_web',
    produto_id='qra_frete_12_meses',
    purchase_token='asaas:'||p_checkout_id,
    order_id=p_checkout_id,
    observacao='Acesso anual QRA FRETE — R$ 119,90 via Asaas',
    atualizado_em=now();

  update public.pagamentos_asaas_qra
  set status='PAID',evento_pago_id=p_event_id,atualizado_em=now()
  where checkout_id=p_checkout_id;

  return query select v_pag.user_id, v_novo, false;
end;
$$;

revoke all on function public.processar_checkout_asaas_qra(text,text,numeric) from public, anon, authenticated;
grant execute on function public.processar_checkout_asaas_qra(text,text,numeric) to service_role;
