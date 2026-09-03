export default function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-red-50">
      <div className="flex items-start justify-between gap-1 mb-2">
        <span className="text-xl flex-shrink-0">{icon}</span>
        {sub && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${color}`}>{sub}</span>
        )}
      </div>
      <p className="text-xl font-bold text-gray-900 mb-0.5 truncate" style={{ fontFamily: "Poppins,sans-serif" }}>
        {value}
      </p>
      <p className="text-[11px] text-gray-500 leading-tight">{label}</p>
    </div>
  );
}
