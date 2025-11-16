import '@testing-library/jest-dom'

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? 'sk_test_dummy'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-key'

if (typeof global.fetch === 'undefined') {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({}),
    text: async () => ''
  })
}
