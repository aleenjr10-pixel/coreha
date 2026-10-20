# Supabase setup

The whole database is defined in one script: [`schema.sql`](schema.sql).

## Apply or update the database

Open the Supabase SQL editor, paste the full contents of `schema.sql`, and run it.

- Works on a **new** project and on an **existing** one.
- Safe to run **again at any time**: it never drops tables or data. It creates what is missing and replaces functions, triggers, and access policies with the current versions.
- Runs in a single transaction, so it either applies completely or not at all.

To change the database, edit `schema.sql` (keep every statement re-runnable: `if not exists`, `create or replace`, `drop ... if exists` before `create`) and run it again.

The files in [`archive/`](archive/) are the step-by-step migrations used before the single script. They are kept for history only; do not run them.

## Automatic alerts and push notifications

- Every morning at 06:00 UTC, `pg_cron` runs `public.generate_due_alerts()`. It creates an alert for each active machine due today or overdue, and re-sends the push for alerts still unanswered after a day. Admins can run the same check from the Equipment page ("Run due-date check").
- Every new alert is pushed to the phones of the restaurant's members through the Expo push service, using `pg_net`. Delivery (phones reached, errors) is logged on the alert and shown in the admin.
- The script enables `pg_net` and `pg_cron` itself. If it ever fails to, enable both under Database → Extensions in Supabase and run the script again.
- Check the scheduled job with `select * from cron.job;` and its runs with `select * from cron.job_run_details order by start_time desc limit 10;`.

## Roles

- `customer`: restaurant users (mobile app) who manage their restaurant, equipment, cleaning requests, and consultation requests
- `admin`: CoreHa staff (admin website) who manage inventory, requests, suppliers, quote requests, and offer analysis

Only admins can change roles. New sign-ups always get the `customer` role.

## First admin

Create a user in Supabase Auth, then run this in the SQL editor:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin@email.com';
```

## Notes

- `profiles` is linked to `auth.users`; a profile is created automatically for every new user.
- A restaurant's owner is added to `restaurant_members` automatically; access checks use membership.
- Row Level Security is enabled on every table. Customers only see their own restaurant's data; suppliers and quote recipients are admin-only.
- Consultation photos are stored in the private `consultation-photos` bucket under `<restaurant_id>/`.
