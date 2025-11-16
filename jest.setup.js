import '@testing-library/jest-dom'

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? 'sk_test_dummy'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-key'
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? 'test-issuer'
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? 'test-audience'
process.env.INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? 'test-internal-secret'

if (typeof global.fetch === 'undefined') {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({}),
    text: async () => ''
  })
}
