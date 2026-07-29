export const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0
});

export function formatMoney(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0);
}

export function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short"
  }).format(date);
}

export function clampNumber(value: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function moneyToNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return 0;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  return clampNumber(Number(normalized));
}

export function textValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}
