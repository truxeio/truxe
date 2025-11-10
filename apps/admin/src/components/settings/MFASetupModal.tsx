import React, { useEffect, useState } from 'react'
import axios from '../../lib/axios'

interface MFASetupModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

const MFASetupModal: React.FC<MFASetupModalProps> = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState(1)
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [otpauthUrl, setOtpauthUrl] = useState('')
  const [manualEntryCode, setManualEntryCode] = useState('')
  const [token, setToken] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    if (step !== 1) return
    ;(async () => {
      try {
        setError(null)
        setLoading(true)
        const res = await axios.post('/auth/mfa/setup')
        setQrCode(res.data.qrCode)
        setSecret(res.data.secret)
        setOtpauthUrl(res.data.otpauthUrl)
        setManualEntryCode(res.data.manualEntryCode)
      } catch (e: any) {
        setError(e?.response?.data?.message || 'Failed to start MFA setup')
      } finally {
        setLoading(false)
      }
    })()
  }, [isOpen, step])

  async function handleVerify() {
    try {
      setError(null)
      setLoading(true)
      const res = await axios.post('/auth/mfa/enable', { token })
      setBackupCodes(res.data.backupCodes || [])
      setStep(3)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  function downloadBackupCodes() {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'truxe-backup-codes.txt'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', padding: 24, borderRadius: 8, width: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Enable Two-Factor Authentication</h3>
          <button onClick={onClose}>Close</button>
        </div>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        {step === 1 && (
          <div>
            <p>Scan this QR code with your authenticator app, or enter the code manually.</p>
            {loading ? (
              <div>Loading...</div>
            ) : (
              <div style={{ display: 'flex', gap: 16 }}>
                <img src={qrCode} alt="MFA QR" style={{ width: 180, height: 180 }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Manual code</div>
                  <div style={{ fontFamily: 'monospace' }}>{manualEntryCode}</div>
                  <div style={{ marginTop: 8 }}>
                    <a href={otpauthUrl} target="_blank" rel="noreferrer">Open in authenticator</a>
                  </div>
                </div>
              </div>
            )}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setStep(2)} disabled={loading}>Next</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <p>Enter the 6-digit code from your authenticator app to verify.</p>
            <input value={token} onChange={e => setToken(e.target.value)} placeholder="123456" style={{ fontSize: 16, padding: 8, width: '100%', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setStep(1)} disabled={loading}>Back</button>
              <button onClick={handleVerify} disabled={loading || token.length < 6}>Verify</button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <p>MFA enabled successfully. Save your backup codes in a secure location.</p>
            <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 6, maxHeight: 200, overflow: 'auto' }}>
{backupCodes.join('\n')}
            </pre>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={downloadBackupCodes}>Download</button>
              <button onClick={() => { onComplete(); onClose(); }}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MFASetupModal
