// "Message privately" hands off to the operational chat (PLAN.md §7.8): no DMs in Z.
// CHAT_DEEPLINK_TEMPLATE, e.g. "chat://user/{handle}" or "https://chat.example/dm/{handle}".

const UNSAFE = /^\s*(javascript|data|vbscript):/i;

/** The deep link for a user, or null when no (safe) template is configured. */
export function chatLink(handle: string, template = process.env.CHAT_DEEPLINK_TEMPLATE) {
  if (!template || !template.includes("{handle}") || UNSAFE.test(template)) return null;
  return template.replaceAll("{handle}", encodeURIComponent(handle));
}
