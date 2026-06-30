// Tiny timestamped logger. Keeps run output readable in cron logs.
function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
export const log = {
  info:  (...a) => console.log(`[${ts()}]`, ...a),
  warn:  (...a) => console.warn(`[${ts()}] ⚠`, ...a),
  error: (...a) => console.error(`[${ts()}] ✗`, ...a),
  ok:    (...a) => console.log(`[${ts()}] ✓`, ...a),
  step:  (...a) => console.log(`[${ts()}] →`, ...a),
};
