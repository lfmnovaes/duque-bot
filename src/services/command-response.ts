/**
 * Converts literal `\n` sequences typed by users into actual line breaks (U+000A).
 * Discord desktop doesn't support Shift+Enter in slash command inputs,
 * so users type `\n` as a workaround. Multiple `\n` are supported.
 */
export function processResponse(response: string): string {
  return response.replace(/\\n/g, "\u000A");
}
