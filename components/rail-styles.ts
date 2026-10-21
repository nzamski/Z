// The rail item look, shared by the server rail (components/nav-rail.tsx: the bell) and the client
// RailLink. Not in rail-link.tsx: a "use client" module hands server code a client reference, not
// the string.
export const railItem =
  "flex items-center justify-center gap-4 rounded-full p-3 text-lg transition-colors hover:bg-neutral-500/10 aria-[current=page]:font-bold xl:justify-start xl:px-4 xl:after:hidden";
