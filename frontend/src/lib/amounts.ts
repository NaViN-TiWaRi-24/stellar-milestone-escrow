export const STROOPS_PER_XLM = 10_000_000n;

export function xlmToStroops(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const whole = BigInt(match[1]);
  const fractional = (match[2] ?? "").padEnd(7, "0");
  return whole * STROOPS_PER_XLM + BigInt(fractional || "0");
}

export function formatXlm(stroops: bigint): string {
  const sign = stroops < 0n ? "-" : "";
  const absolute = stroops < 0n ? -stroops : stroops;
  const whole = absolute / STROOPS_PER_XLM;
  const fraction = (absolute % STROOPS_PER_XLM)
    .toString()
    .padStart(7, "0")
    .replace(/0+$/, "");

  return `${sign}${whole}${fraction ? `.${fraction}` : ""} XLM`;
}

export function formatTokenAmount(
  amount: bigint,
  isNativeXlm: boolean,
): string {
  return isNativeXlm ? formatXlm(amount) : `${amount.toString()} token units`;
}
