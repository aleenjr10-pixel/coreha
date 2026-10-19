# Supabase setup

The whole database is defined in one script: [`schema.sql`](schema.sql).

## Apply or update the database

Open the Supabase SQL editor, paste the full contents of `schema.sql`, and run it.

- Works on a **new** project and on an **existing** one.
- Safe to run **again at any time**: it never drops tables or data. It creates what is missing and replaces functions, triggers, and access policies with the current versions.
- Runs in a single transaction, so it either applies completely or not at all.

To change the database, edit `schema.sql` (keep every statement re-runnable: `if not exists`, `create or replace`, `drop ... if exists` before `create`) and run it again.

The files in [`archive/`](archive/) are the step-by-step migrations used before the single script. They are kept for history only; do not run them.

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
