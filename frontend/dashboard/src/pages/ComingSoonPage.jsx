export default function ComingSoonPage({ label }) {
  return (
    <div className="p-4 md:p-6">
      <div className="bg-white rounded-xl border border-red-50 shadow-sm p-6 text-center">
        <p className="text-sm text-gray-500">
          <strong className="text-gray-900">{label}</strong> — à venir dans une prochaine étape.
        </p>
      </div>
    </div>
  );
}
