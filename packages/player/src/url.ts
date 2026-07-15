// Dev/agent URL parameters, honored in dev builds:
//   ?t=14.2   seek and pause on load
//   &nochrome hide the controls
//   &state    dump displayed state to window.__XV_STATE__ and console

export interface DevParams {
  t?: number;
  nochrome: boolean;
  state: boolean;
}

export function parseDevParams(search: string): DevParams {
  const q = new URLSearchParams(search);
  const tRaw = q.get("t");
  const t = tRaw !== null && Number.isFinite(Number(tRaw)) ? Number(tRaw) : undefined;
  return { t, nochrome: q.has("nochrome"), state: q.has("state") };
}
