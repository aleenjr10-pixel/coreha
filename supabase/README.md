# Supabase setup

This folder contains the initial database schema for CoreHa.

## Apply the schema

Run the contents of `schema.sql` in the Supabase SQL editor or with the Supabase CLI.

## Roles

The application uses two primary roles:

- `customer`: restaurant users who manage their restaurant, equipment, alerts, and consultation requests
- `admin`: CoreHa staff who manage inventory, leads, supplier requests, and offer analysis

## Notes

- The `profiles` table is linked to `auth.users`.
- New users inserted into `auth.users` automatically create a matching row in `public.profiles`.
- Restaurant ownership is handled via `restaurants.owner_id` and membership is tracked in `restaurant_members`.
- RLS is enabled for all key tables so customer and admin access are segregated by role and restaurant membership.

## Suggested first admin setup

Create a user in Supabase Auth and then update their profile role to `admin`:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin@email.com';
```
