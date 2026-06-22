import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency, formatMonthLabel } from "../utils/format";

function CurrencyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <p className="tooltip-label">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color || entry.payload.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

const DEPT_COLORS = ["#6366f1", "#06b6d4", "#22c55e", "#f97316", "#ec4899", "#eab308", "#8b5cf6"];

// Pasta grafiği için SVG dışına yerleşen, düzgün sarmalanan özel gösterge
function CategoryLegend({ data }) {
  return (
    <ul className="pie-legend">
      {data.map((entry) => (
        <li key={entry.name}>
          <span className="legend-dot" style={{ backgroundColor: entry.color }} />
          {entry.name}
        </li>
      ))}
    </ul>
  );
}

// Server'dan gelen stats nesnesini grafiklere dönüştürür
export default function Charts({ stats }) {
  const categoryData = stats.byCategory || [];
  const departmentData = stats.byDepartment || [];
  const monthlyData = (stats.byMonth || []).slice(-6).map((m) => ({
    month: formatMonthLabel(m.month),
    gelir: m.gelir,
    gider: m.gider,
  }));

  return (
    <section className="charts">
      <div className="chart-card">
        <h2>Gider Kategorileri</h2>
        {categoryData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                paddingAngle={2}
              >
                {categoryData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CurrencyTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="empty-state">Gider ekledikçe dağılım burada görünecek.</p>
        )}
        {categoryData.length > 0 && <CategoryLegend data={categoryData} />}
      </div>

      <div className="chart-card">
        <h2>Aylık Gelir / Gider</h2>
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                width={70}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "#ffffff0a" }} />
              <Legend />
              <Bar dataKey="gelir" name="Gelir" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gider" name="Gider" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="empty-state">İşlem ekledikçe aylık grafik burada görünecek.</p>
        )}
      </div>

      <div className="chart-card chart-wide">
        <h2>Departman Bazlı Gider</h2>
        {departmentData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={departmentData} layout="vertical" margin={{ left: 30 }}>
              <XAxis
                type="number"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
                width={150}
              />
              <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "#ffffff0a" }} />
              <Bar dataKey="value" name="Gider" radius={[0, 4, 4, 0]}>
                {departmentData.map((entry, i) => (
                  <Cell key={entry.name} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="empty-state">Departmanlı gider ekledikçe burada görünecek.</p>
        )}
      </div>
    </section>
  );
}
