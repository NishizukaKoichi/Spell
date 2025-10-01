"use client"

import { useEffect, useState } from "react"

export default function LoginPage() {
  const [webauthnSupport, setWebauthnSupport] = useState<'checking' | 'full' | 'manual' | 'none'>('checking')
  const [showRecoveryCode, setShowRecoveryCode] = useState(false)

  useEffect(() => {
    checkWebAuthnSupport().then(support => {
      if (!support.available) {
        setWebauthnSupport('none')
      } else if (support.conditionalUI) {
        setWebauthnSupport('full')
        setupAutoLogin()
      } else {
        setWebauthnSupport('manual')
      }
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-slate-800 p-8 rounded-lg shadow-xl max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">ログイン</h1>
          <p className="text-slate-400">Spell Platformへようこそ</p>
        </div>

        <div className="space-y-4">
          {/* Always show GitHub button */}
          <button
            onClick={loginWithGitHub}
            className="w-full px-6 py-3 bg-slate-900 hover:bg-slate-700 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHubで続行
          </button>

          {/* Manual passkey button (if browser supports but not conditional) */}
          {webauthnSupport === 'manual' && (
            <button
              onClick={loginWithPasskey}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
            >
              パスキーでログイン
            </button>
          )}

          {/* Recovery code link */}
          <button
            onClick={() => setShowRecoveryCode(true)}
            className="w-full text-sm text-slate-400 hover:text-slate-300 hover:underline"
          >
            パスキーを紛失しましたか？リカバリコードを使用
          </button>
        </div>

        {/* Recovery code modal */}
        {showRecoveryCode && (
          <RecoveryCodeModal onClose={() => setShowRecoveryCode(false)} />
        )}
      </div>
    </div>
  )
}

function RecoveryCodeModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/auth/recovery-code/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })

      if (res.ok) {
        const { token, must_register_passkey } = await res.json()
        localStorage.setItem('jwt', token)

        if (must_register_passkey) {
          window.location.href = '/settings/passkeys?force=true'
        } else {
          window.location.href = '/'
        }
      } else {
        alert('無効なリカバリコードです')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 p-6 rounded-lg max-w-md w-full space-y-4">
        <h2 className="text-xl font-bold text-white">リカバリコードログイン</h2>
        <p className="text-sm text-slate-400">
          8桁のリカバリコードを入力してください
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="12345678"
            pattern="[0-9]{8}"
            required
            className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg border border-slate-700 focus:border-blue-500 outline-none"
            autoFocus
          />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg font-semibold transition"
            >
              {loading ? '確認中...' : 'ログイン'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Browser support check
async function checkWebAuthnSupport(): Promise<{
  available: boolean
  conditionalUI: boolean
  platform: string
}> {
  if (!window.PublicKeyCredential) {
    return { available: false, conditionalUI: false, platform: 'none' }
  }

  const conditionalUI = await PublicKeyCredential.isConditionalMediationAvailable?.() ?? false

  const ua = navigator.userAgent
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua)

  return {
    available: true,
    conditionalUI,
    platform: isSafari ? 'safari' : 'standard'
  }
}

// Auto-trigger WebAuthn
function setupAutoLogin() {
  // TODO: Implement conditional mediation
  console.log('Auto-login with WebAuthn conditional mediation')
}

function loginWithGitHub() {
  window.location.href = '/api/auth/github'
}

function loginWithPasskey() {
  // TODO: Implement manual passkey login
  console.log('Manual passkey login')
}