export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        textAlign: 'center',
        padding: '0 1.5rem',
      }}
    >
      <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>Spell Platform API</p>
      <p style={{ maxWidth: 520, lineHeight: 1.5 }}>
        This deployment is intentionally headless. All functionality described in{' '}
        <code>Spec.md</code> is exposed through authenticated HTTP APIs consumed by ChatGPT Apps
        SDK, CLI, or other automation clients.
      </p>
    </main>
  );
}
