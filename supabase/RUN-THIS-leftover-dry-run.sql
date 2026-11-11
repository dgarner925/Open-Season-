select net.http_post(
  url := 'https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/ingest-leftover-tags',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', (select 'Bearer ' || substring(command from 'Bearer ([A-Za-z0-9_.-]+)')
                        from cron.job where jobname = 'send-alerts-daily' limit 1)
  ),
  body := '{"state":"CO","dry":true}'::jsonb,
  timeout_milliseconds := 120000
) as request_id;
