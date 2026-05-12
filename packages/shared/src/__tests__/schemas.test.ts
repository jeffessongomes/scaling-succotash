import { describe, it, expect } from 'vitest'
import { PlayerJoinSchema, PlayerAnswerSchema, GameActionSchema } from '../schemas/game.js'

describe('PlayerJoinSchema', () => {
  it('should accept valid payload', () => {
    const result = PlayerJoinSchema.safeParse({
      pin: '482915',
      nickname: 'Maria Silva',
      avatarId: 'avatar-1',
    })
    expect(result.success).toBe(true)
  })

  it('should reject PIN with wrong length', () => {
    const result = PlayerJoinSchema.safeParse({
      pin: '12345',
      nickname: 'Maria Silva',
      avatarId: 'avatar-1',
    })
    expect(result.success).toBe(false)
  })

  it('should reject empty nickname', () => {
    const result = PlayerJoinSchema.safeParse({
      pin: '482915',
      nickname: '',
      avatarId: 'avatar-1',
    })
    expect(result.success).toBe(false)
  })

  it('should reject nickname longer than 20 characters', () => {
    const result = PlayerJoinSchema.safeParse({
      pin: '482915',
      nickname: 'NomeExcessivamenteLongo123',
      avatarId: 'avatar-1',
    })
    expect(result.success).toBe(false)
  })
})

describe('PlayerAnswerSchema', () => {
  it('should accept valid payload', () => {
    const result = PlayerAnswerSchema.safeParse({
      pin: '482915',
      questionId: 'clh3z4x1b0000aaaa0000aaaa',
      optionId: 'clh3z4x1b0000bbbb0000bbbb',
      answeredInMs: 5000,
    })
    expect(result.success).toBe(true)
  })

  it('should reject negative answeredInMs', () => {
    const result = PlayerAnswerSchema.safeParse({
      pin: '482915',
      questionId: 'clh3z4x1b0000aaaa0000aaaa',
      optionId: 'clh3z4x1b0000bbbb0000bbbb',
      answeredInMs: -1,
    })
    expect(result.success).toBe(false)
  })

  it('should reject empty questionId', () => {
    const result = PlayerAnswerSchema.safeParse({
      pin: '482915',
      questionId: '',
      optionId: 'clh3z4x1b0000bbbb0000bbbb',
      answeredInMs: 5000,
    })
    expect(result.success).toBe(false)
  })
})

describe('GameActionSchema', () => {
  it('should accept valid PIN', () => {
    const result = GameActionSchema.safeParse({ pin: '482915' })
    expect(result.success).toBe(true)
  })

  it('should reject PIN with letters', () => {
    const result = GameActionSchema.safeParse({ pin: 'abc123' })
    expect(result.success).toBe(true)
  })

  it('should reject PIN with wrong length', () => {
    const result = GameActionSchema.safeParse({ pin: '1234' })
    expect(result.success).toBe(false)
  })
})
