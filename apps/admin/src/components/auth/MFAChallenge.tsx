import React, { useState } from 'react'
import axios from '../../lib/axios'

interface MFAChallengeProps {
  challengeId: string
  onSuccess: (result: { accessToken: string; refreshToken: string }) => void
}

const MFAChallenge: React.FC<MFAChallengeProps> = ({ challengeId, onSuccess }) => {
  const [token, setToken] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const [mode, setMode] = useState<'totp' | 'backup'>('totp')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    try {
      setLoading(true)
      setError(null)
      const body: any = { challengeId }
      if (mode === 'totp') body.token = token
      else body.backupCode = backupCode

      const res = await axios.post('/auth/mfa/challenge/verify', body)
      const tokens = res.data?.tokens
      if (tokens?.accessToken && tokens?.refreshToken) {
        onSuccess({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
      } else {
        setError('Unexpected response from server')
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h3>Two-Factor Authentication Required</h3>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setMode('totp')} disabled={mode === 'totp'}>Use Authenticator App</button>
        <button onClick={() => setMode('backup')} style={{ marginLeft: 8 }} disabled={mode === 'backup'}>Use Backup Code</button>
      </div>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {mode === 'totp' ? (
        <div>
          <input value={token} onChange={e => setToken(e.target.value)} placeholder="6-digit code" style={{ padding: 8, width: '100%', marginBottom: 8 }} />
        </div>
      ) : (
        <div>
          <input value={backupCode} onChange={e => setBackupCode(e.target.value)} placeholder="Backup code" style={{ padding: 8, width: '100%', marginBottom: 8 }} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={submit} disabled={loading || (mode === 'totp' ? token.length < 6 : backupCode.length < 6)}>Verify</button>
      </div>
    </div>
  )
}

export default MFAChallenge
