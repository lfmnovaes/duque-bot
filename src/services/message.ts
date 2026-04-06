/**
 * Discord message character limit for non-Nitro users and bots.
 * @see https://docs.discord.com/developers/resources/message#create-message
 */
export const DISCORD_MESSAGE_LIMIT = 2000;

/**
 * Converts literal `\n` sequences typed by users into actual line breaks (U+000A).
 * Discord desktop doesn't support Shift+Enter in slash command inputs,
 * so users type `\n` as a workaround. Multiple `\n` are supported.
 */
export function encodeLineBreaks(response: string): string {
  return response.replace(/\\n/g, "\n");
}

/**
 * Converts actual line breaks (U+000A) back into literal `\n` sequences.
 * Used to display the raw form for easy copy-paste editing.
 */
export function decodeLineBreaks(response: string): string {
  return response.replace(/\n/g, "\\n");
}

/**
 * Splits a message into chunks that fit within Discord's character limit,
 * preferring to break on newlines to preserve formatting.
 */
export function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let current = text;

  while (current.length > maxLength) {
    let splitIndex = current.lastIndexOf("\n", maxLength);
    if (splitIndex <= 0) {
      splitIndex = maxLength;
    }
    chunks.push(current.slice(0, splitIndex));
    current = current.slice(splitIndex).trimStart();
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}
