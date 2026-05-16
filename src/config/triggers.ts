export const ALLOWED_TRIGGER_PREFIX_CHARS =
  "!@#$%^&*()_+-=[]{}|;:,.?~" as const;

export const ALLOWED_PREFIX_LIST =
  ALLOWED_TRIGGER_PREFIX_CHARS.split("").join(" ");

const ALLOWED_TRIGGER_PREFIX = /^[!@#$%^&*()_+\-=[\]{}|;:,.?~]$/;

export function isAllowedTriggerPrefix(prefix: string): boolean {
  return ALLOWED_TRIGGER_PREFIX.test(prefix);
}

export function startsWithAllowedTriggerPrefix(content: string): boolean {
  const firstCharacter = content[0];
  return (
    firstCharacter !== undefined &&
    ALLOWED_TRIGGER_PREFIX_CHARS.includes(firstCharacter)
  );
}
