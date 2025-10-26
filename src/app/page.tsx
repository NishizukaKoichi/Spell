export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">Spell Platform</h1>
        <p className="text-lg mb-8">
          WASM-first execution platform for creator-to-consumer workflows
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">For Makers</h2>
            <p>Compile your tools to WASM and monetize instantly</p>
          </div>
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">For Casters</h2>
            <p>Execute diverse functions via one API endpoint</p>
          </div>
        </div>
      </div>
    </main>
  );
}
