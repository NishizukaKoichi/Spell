export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center space-y-8 p-8">
        <h1 className="text-6xl font-bold text-white mb-4">
          Spell Platform
        </h1>
        <p className="text-xl text-slate-300 max-w-2xl">
          ワンタップで詠唱。コードを呪文に変えるCtoCマーケットプレイス
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
          >
            始める
          </a>
          <a
            href="/bazaar"
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition"
          >
            Bazaarを見る
          </a>
        </div>
      </div>
    </div>
  )
}