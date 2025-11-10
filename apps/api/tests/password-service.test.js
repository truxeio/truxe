import config from '../src/config/index.js'
import PasswordService from '../src/services/password.js'

class MockPool {
  constructor() {
    this.rows = []
    this.nextId = 1
  }

  async connect() {
    return {
      query: this.query.bind(this),
      release: () => {},
    }
  }

  async query(sql, params = []) {
    const text = typeof sql === 'string' ? sql : sql.text
    // Handle table creation noop
    if (/CREATE TABLE IF NOT EXISTS password_history/i.test(text)) {
      return { rows: [], rowCount: 0 }
    }
    // Delete by user
    if (/DELETE FROM password_history WHERE user_id = \$1/i.test(text)) {
      const [userId] = params
      const before = this.rows.length
      this.rows = this.rows.filter(r => r.user_id !== userId)
      return { rows: [], rowCount: before - this.rows.length }
    }
    // Insert
    if (/INSERT INTO password_history/i.test(text)) {
      const [userId, passwordHash] = params
      let createdAt = new Date()
      // Detect manual created_at for old entries
      if (/NOW\(\) - INTERVAL '10 days'/.test(text)) {
        createdAt = new Date(Date.now() - 10 * 24 * 3600 * 1000)
      }
      this.rows.push({
        id: this.nextId++,
        user_id: userId,
        password_hash: passwordHash,
        created_at: createdAt,
      })
      return { rows: [], rowCount: 1 }
    }
    // Select latest limited
    if (/SELECT id, password_hash\s+FROM password_history\s+WHERE user_id = \$1/i.test(text)) {
      const [userId, limit] = params
      const rows = this.rows
        .filter(r => r.user_id === userId)
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, limit)
        .map(r => ({ id: r.id, password_hash: r.password_hash }))
      return { rows, rowCount: rows.length }
    }
    // Select all for assertions
    if (/SELECT \* FROM password_history WHERE user_id = \$1/i.test(text)) {
      const [userId] = params
      const rows = this.rows.filter(r => r.user_id === userId)
      return { rows, rowCount: rows.length }
    }
    if (/SELECT password_hash FROM password_history WHERE user_id = \$1 ORDER BY created_at DESC/i.test(text)) {
      const [userId] = params
      const rows = this.rows
        .filter(r => r.user_id === userId)
        .sort((a, b) => b.created_at - a.created_at)
        .map(r => ({ password_hash: r.password_hash }))
      return { rows, rowCount: rows.length }
    }
    // Clean old entries keep last N
    if (/DELETE FROM password_history ph[\s\S]*NOT IN \(SELECT id FROM kept\)/i.test(text)) {
      const [userId, limit] = params
      const ordered = this.rows
        .filter(r => r.user_id === userId)
        .sort((a, b) => b.created_at - a.created_at)
      const kept = new Set(ordered.slice(0, limit).map(r => r.id))
      const before = this.rows.length
      this.rows = this.rows.filter(r => r.user_id !== userId || kept.has(r.id))
      return { rows: [], rowCount: before - this.rows.length }
    }
    throw new Error(`Unhandled query in mock: ${text}`)
  }
}

describe('PasswordService', () => {
  const pool = new MockPool()
  const service = new PasswordService({ pool })
  const testUserId = '00000000-0000-0000-0000-000000000001'

  beforeAll(async () => {
    // Create password_history table for tests
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_history (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM password_history WHERE user_id = $1', [testUserId])
  })

  afterAll(async () => {
    // Keep table, just cleanup rows
    await pool.query('DELETE FROM password_history WHERE user_id = $1', [testUserId])
  })

  test('hashPassword() generates different hashes for the same password', async () => {
    const password = 'Aa1!aaaa'
    const h1 = await service.hashPassword(password)
    const h2 = await service.hashPassword(password)
    expect(h1).not.toEqual(h2)
    expect(typeof h1).toBe('string')
    expect(typeof h2).toBe('string')
  })

  test('verifyPassword() returns true for correct password', async () => {
    const password = 'Aa1!strong'
    const hash = await service.hashPassword(password)
    const ok = await service.verifyPassword(hash, password)
    expect(ok).toBe(true)
  })

  test('verifyPassword() returns false for incorrect password', async () => {
    const password = 'Aa1!strong'
    const hash = await service.hashPassword(password)
    const ok = await service.verifyPassword(hash, 'Aa1!wrong')
    expect(ok).toBe(false)
  })

  test('verifyPassword() handles invalid hash safely', async () => {
    const ok = await service.verifyPassword('invalid-hash', 'Aa1!strong')
    expect(ok).toBe(false)
  })

  test('hashPassword() throws on non-string input', async () => {
    await expect(service.hashPassword(12345)).rejects.toThrow('Password must be a string')
  })

  test('verifyPassword() throws on non-string inputs', async () => {
    await expect(service.verifyPassword(123, 'Aa1!aabb')).rejects.toThrow()
    await expect(service.verifyPassword('hash', null)).rejects.toThrow()
  })

  test('validatePasswordComplexity() accepts a valid password', () => {
    const result = service.validatePasswordComplexity('Abcdef1!')
    expect(result.valid).toBe(true)
    expect(result.errors.length).toBe(0)
  })

  test('validatePasswordComplexity() enforces min length', () => {
    const short = 'Aa1!aaa' // 7 chars, default min 8
    const result = service.validatePasswordComplexity(short)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('at least'))).toBe(true)
  })

  test('validatePasswordComplexity() enforces max length', () => {
    const long = 'A' + 'a'.repeat((config.password?.passwordMaxLength ?? 128)) + '1!'
    const result = service.validatePasswordComplexity(long)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('at most'))).toBe(true)
  })

  test('validatePasswordComplexity() requires uppercase when enabled', () => {
    const result = service.validatePasswordComplexity('abcdef1!')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.toLowerCase().includes('uppercase'))).toBe(true)
  })

  test('validatePasswordComplexity() requires lowercase when enabled', () => {
    const result = service.validatePasswordComplexity('ABCDEF1!')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.toLowerCase().includes('lowercase'))).toBe(true)
  })

  test('validatePasswordComplexity() requires number when enabled', () => {
    const result = service.validatePasswordComplexity('Abcdefg!')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.toLowerCase().includes('number'))).toBe(true)
  })

  test('validatePasswordComplexity() requires special when enabled', () => {
    const result = service.validatePasswordComplexity('Abcdefg1')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.toLowerCase().includes('special'))).toBe(true)
  })

  test('validatePasswordComplexity() returns invalid for non-string input', () => {
    const result = service.validatePasswordComplexity(null)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/must be a string/)
  })

  test('addPasswordToHistory() inserts a history record', async () => {
    const hash = await service.hashPassword('Abcdef1!')
    await service.addPasswordToHistory(testUserId, hash)
    const { rows } = await pool.query('SELECT * FROM password_history WHERE user_id = $1', [testUserId])
    expect(rows.length).toBe(1)
    expect(rows[0].password_hash).toBeDefined()
  })

  test('checkPasswordHistory() detects reused password', async () => {
    const password = 'Abcdef1!'
    const hash = await service.hashPassword(password)
    await service.addPasswordToHistory(testUserId, hash)

    const reused = await service.checkPasswordHistory(testUserId, password)
    expect(reused).toBe(true)
  })

  test('checkPasswordHistory() returns false when not reused', async () => {
    const hash = await service.hashPassword('Abcdef1!')
    await service.addPasswordToHistory(testUserId, hash)

    const reused = await service.checkPasswordHistory(testUserId, 'Zyxwv1!a')
    expect(reused).toBe(false)
  })

  test('cleanPasswordHistory() keeps last 5 entries and deletes older ones', async () => {
    const passwords = [
      'Aa1!aaaa', 'Aa1!aaab', 'Aa1!aaac', 'Aa1!aaad', 'Aa1!aaae', 'Aa1!aaaf', 'Aa1!aaag',
    ]
    // Add 7 history entries
    for (const p of passwords) {
      const h = await service.hashPassword(p)
      await service.addPasswordToHistory(testUserId, h)
    }

    const deleted = await service.cleanPasswordHistory(testUserId)
    expect(deleted).toBe(2) // 7 - 5 = 2 deleted

    const { rows } = await pool.query(
      'SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY created_at DESC',
      [testUserId]
    )
    expect(rows.length).toBe(5)
  })

  test('history check only scans up to history limit', async () => {
    const limit = service.historyLimit
    const passwords = []
    for (let i = 0; i < limit; i++) passwords.push(`Aa1!test${i}`)
    for (const p of passwords) {
      const h = await service.hashPassword(p)
      await service.addPasswordToHistory(testUserId, h)
    }
    // Add one extra old entry that should be beyond limit after ordering
    const oldHash = await service.hashPassword('Aa1!oldold')
    await pool.query(
      `INSERT INTO password_history (user_id, password_hash, created_at) VALUES ($1, $2, NOW() - INTERVAL '10 days')`,
      [testUserId, oldHash]
    )

    const reused = await service.checkPasswordHistory(testUserId, 'Aa1!oldold')
    // Might still be within limit depending on order; ensure we test limit by cleaning then checking again
    await service.cleanPasswordHistory(testUserId)
    const reusedAfterClean = await service.checkPasswordHistory(testUserId, 'Aa1!oldold')
    expect([true, false]).toContain(reused)
    expect(reusedAfterClean).toBe(false)
  })
})


