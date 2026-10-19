// Grant, revoke and list Z admins from the command line (docs/moderation.md). This is how the
// first admin is made; after that, admins can also grant and revoke each other on /admin.
// Shipped in the image as `node admin.mjs`; locally `node --env-file=.env scripts/admin.mjs`.
//
//   node admin.mjs list
//   node admin.mjs grant  <handle> "<reason>"
//   node admin.mjs revoke <handle> "<reason>"
//
// Plain SQL (the image has no TypeScript service layer), mirroring grantAdmin/revokeAdmin in
// lib/services.ts: a soft delete for revoke, and an audit row with actor_id NULL ("command line").
import { readFileSync } from "node:fs";
import postgres from "postgres";

const [cmd, rawHandle, ...rest] = process.argv.slice(2);
const reason = rest.join(" ").trim();
const usage = () => {
  console.error('usage: admin.mjs list | grant <handle> "<reason>" | revoke <handle> "<reason>"');
  process.exit(2);
};
if (cmd !== "list" && (!["grant", "revoke"].includes(cmd) || !rawHandle || !reason)) usage();
if (reason.length > 300) {
  console.error("admin: reason is longer than 300 characters");
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("admin: DATABASE_URL is not set");
  process.exit(1);
}
const ca = process.env.DATABASE_CA_FILE;
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  onnotice: () => {},
  ...(ca ? { ssl: { ca: readFileSync(ca, "utf8") } } : {}),
});

try {
  if (cmd === "list") {
    const rows = await sql`
      select u.handle, u.display_name, a.created_at
      from admins a join users u on u.id = a.user_id
      where a.deleted_at is null and u.deleted_at is null
      order by a.created_at`;
    if (!rows.length) console.log("admin: no admins yet");
    for (const r of rows)
      console.log(`@${r.handle}\t${r.display_name}\tsince ${r.created_at.toISOString()}`);
  } else {
    const handle = rawHandle.replace(/^@/, "").toLowerCase();
    await sql.begin(async (tx) => {
      const [u] = await tx`
        select id from users where handle = ${handle} and deleted_at is null`;
      if (!u) throw new Error(`no active user @${handle}`);
      const changed =
        cmd === "grant"
          ? await tx`
              insert into admins (user_id) values (${u.id})
              on conflict (user_id) where deleted_at is null do nothing
              returning id`
          : await tx`
              update admins set deleted_at = now(), updated_at = now()
              where user_id = ${u.id} and deleted_at is null
              returning id`;
      if (!changed.length) {
        console.log(`admin: @${handle} ${cmd === "grant" ? "is already" : "is not"} an admin`);
        return;
      }
      await tx`
        insert into moderation_actions (actor_id, action, user_id, reason)
        values (null, ${cmd === "grant" ? "grant_admin" : "revoke_admin"}, ${u.id}, ${reason})`;
      console.log(`admin: @${handle} ${cmd === "grant" ? "is now" : "is no longer"} an admin`);
    });
  }
} catch (e) {
  console.error("admin: failed:", e.message ?? e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
