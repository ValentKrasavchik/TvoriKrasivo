/**
 * Normalize phone to digits (for storage). Returns null if invalid.
 */
export function normalizePhone(phone: string): string | null {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10) return null;
  let normalized = digits;
  if (digits.length === 11 && (digits[0] === '8' || digits[0] === '7')) {
    normalized = digits.slice(1);
  } else if (digits.length === 10) {
    normalized = digits;
  } else {
    return null;
  }
  return '+7' + normalized;
}
