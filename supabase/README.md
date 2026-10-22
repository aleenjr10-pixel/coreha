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

## Auth emails (welcome and password reset)

Both apps use 6-digit codes from email instead of links, so nothing depends on opening a link on the phone.

1. **SMTP** (Authentication → Emails → SMTP Settings): host `smtp.gmail.com`, port `465`, username `admin@coreha.ro`, password = a Google app password, sender `noreply@coreha.ro` (an alias of admin@ with "Send mail as" enabled in Gmail), sender name `CoreHa`.
2. **Confirm email** on (Authentication → Sign In / Providers → Email). Keep the email OTP length at 6.
3. **Templates** (Authentication → Emails → Templates), paste the HTML from `email-templates/`:
   - "Confirm sign up" → `confirm-signup.html`, subject `Bun venit la CoreHa – codul tău de confirmare`
   - "Reset password" → `reset-password.html`, subject `Codul tău pentru resetarea parolei CoreHa`
4. **Rate limits** (Authentication → Rate Limits): with custom SMTP, raise "emails sent per hour" to fit your sign-ups.

## Roles

- `customer`: restaurant users (mobile app) who manage their restaurant, equipment, cleaning requests, and consultation requests
- `admin`: CoreHa staff (admin website) who manage inventory, requests, suppliers, quote requests, and offer analysis

There is exactly one possible administrator: **admin@coreha.ro** (set in `public.admin_email()`).
The database refuses the admin role for any other email, admin rights also require that the
login email in Supabase Auth is admin@coreha.ro, and users cannot change the email on their profile.
New sign-ups always get the `customer` role. Running `schema.sql` turns any other admin into a customer.

## The admin account

1. In Supabase: Authentication → Users → **Add user** → `admin@coreha.ro`, with a strong password and "Auto confirm user" checked.
2. In the SQL editor:

```sql
update public.profiles
set role = 'admin'
where lower(email) = 'admin@coreha.ro';
```

## Notes

- `profiles` is linked to `auth.users`; a profile is created automatically for every new user.
- A restaurant's owner is added to `restaurant_members` automatically; access checks use membership.
- Row Level Security is enabled on every table. Customers only see their own restaurant's data; suppliers and quote recipients are admin-only.
- Consultation photos are stored in the private `consultation-photos` bucket under `<restaurant_id>/`.
