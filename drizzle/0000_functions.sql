-- UUIDv7 (RFC 9562): 48-bit unix ms timestamp + random bits, version 7, variant 10.
-- Postgres 16 has no built-in v7; this uses only core gen_random_uuid().
CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid
LANGUAGE sql VOLATILE AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid())
          PLACING substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
          FROM 1 FOR 6),
        52, 1),
      53, 1),
    'hex')::uuid
$$;
--> statement-breakpoint
-- Backstop for soft delete and sync readiness: every UPDATE advances updated_at, even raw SQL that forgets it.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$;
