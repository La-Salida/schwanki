-- The language a teacher teaches, read from their Preply profile, so a teacher
-- added from a Preply link can be shown and prefilled before any notes exist.
alter table teachers add column language text check (language is null or language ~ '^[a-z]{2,3}(-[a-z]{2,4})?$');
