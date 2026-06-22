import { formatCurrency } from "../utils/format";

// Toplam gelir, gider, net bakiye ve işlem sayısını gösteren KPI kartları
export default function Summary({ income, expense, count }) {
  const balance = income - expense;
  const margin = income > 0 ? (balance / income) * 100 : 0;

  const cards = [
    {
      label: "Toplam Gelir",
      value: formatCurrency(income),
      className: "card-income",
      icon: "↑",
      hint: "Tüm dönemler",
    },
    {
      label: "Toplam Gider",
      value: formatCurrency(expense),
      className: "card-expense",
      icon: "↓",
      hint: `${count} işlem`,
    },
    {
      label: "Net Bakiye",
      value: formatCurrency(balance),
      className: balance >= 0 ? "card-balance" : "card-balance-negative",
      icon: "₣",
      hint: balance >= 0 ? "Pozitif" : "Negatif",
    },
    {
      label: "Kâr Marjı",
      value: `%${margin.toFixed(1)}`,
      className: margin >= 0 ? "card-margin" : "card-balance-negative",
      icon: "%",
      hint: "Gelir / gider oranı",
    },
  ];

  return (
    <section className="summary">
      {cards.map((card) => (
        <div key={card.label} className={`summary-card ${card.className}`}>
          <span className="summary-icon">{card.icon}</span>
          <div>
            <p className="summary-label">{card.label}</p>
            <p className="summary-value">{card.value}</p>
            <p className="summary-hint">{card.hint}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
