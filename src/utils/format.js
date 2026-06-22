// Para birimini Türk Lirası olarak biçimlendirir
export function formatCurrency(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

// Tarihi okunabilir biçime çevirir: 22 Haz 2026
export function formatDate(isoDate) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(isoDate));
}

// "2026-06" gibi ay anahtarını "Haz 2026" etiketine çevirir
export function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("tr-TR", {
    month: "short",
    year: "numeric",
  }).format(date);
}
