import React, { useEffect, useState } from 'react'
import axios from '../../lib/axios'
import MFASetupModal from './MFASetupModal'

const SecuritySettings: React.FC = () => {
  const [status, setStatus] = useState<{ enabled: boolean; backupCodesRemaining: number } | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      const res = await axios.get('/auth/mfa/status')
      setStatus(res.data)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load MFA status')
    }
  }

  useEffect(() => { refresh() }, [])

  return (
    <div>
      <h2>Security</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>MFA status: {status?.enabled ? 'Enabled' : 'Disabled'}</div>
        {status?.enabled ? (
          <div>Backup codes remaining: {status.backupCodesRemaining}</div>
        ) : null}
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        {!status?.enabled && (
          <button onClick={() => setOpen(true)}>Enable Two-Factor Authentication</button>
        )}
        {status?.enabled && (
          <>
            <button onClick={async () => { await axios.post('/auth/mfa/backup/regenerate', { token: prompt('Enter current 6-digit code') }); await refresh() }}>Regenerate Backup Codes</button>
            <button onClick={async () => { const code = prompt('Enter 6-digit code or a backup code'); await axios.post('/auth/mfa/disable', /\d{6}/.test(code || '') ? { token: code } : { backupCode: code }); await refresh() }}>Disable MFA</button>
          </>
        )}
      </div>
      <MFASetupModal isOpen={open} onClose={() => setOpen(false)} onComplete={() => refresh()} />
    </div>
  )
}

export default SecuritySettings


