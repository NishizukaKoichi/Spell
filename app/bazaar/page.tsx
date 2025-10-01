export default function BazaarPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Bazaar</h1>
          <p className="text-slate-400">公開されているSpellを検索・実行</p>
        </div>

        <div className="mb-6">
          <input
            type="search"
            placeholder="Spellを検索..."
            className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-blue-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder cards */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-slate-800 p-6 rounded-lg border border-slate-700 hover:border-slate-600 transition"
            >
              <h3 className="text-xl font-semibold mb-2">Spell #{i}</h3>
              <p className="text-slate-400 text-sm mb-4">
                Spellの説明がここに表示されます
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">¥100</span>
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition">
                  詠唱
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}