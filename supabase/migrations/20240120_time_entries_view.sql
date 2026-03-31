-- Create a view to aggregate time entries by day and month
create or replace view public.time_entries_monthly
with (security_invoker = true)
as
select
  user_id,
  date_trunc('month', start_at) as month,
  date(start_at) as day,
  sum(
    extract(epoch from (coalesce(end_at, now()) - start_at))
  ) / 3600 as hours
from public.time_entries
where end_at is not null
group by user_id, month, day;

-- Grant access to authenticated users
grant select on public.time_entries_monthly to authenticated;
