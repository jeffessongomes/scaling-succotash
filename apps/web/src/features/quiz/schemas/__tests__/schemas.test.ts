import { describe, it, expect } from 'vitest'
import { CreateQuizSchema } from '../quiz.schema'
import { CreateQuestionSchema } from '../question.schema'
import { CreateOptionSchema } from '../option.schema'
import { LoginSchema } from '@/features/auth/schemas/login.schema'

describe('CreateQuizSchema', () => {
  it('should accept valid title', () => {
    const result = CreateQuizSchema.safeParse({ title: 'História do Brasil' })
    expect(result.success).toBe(true)
  })

  it('should reject empty title', () => {
    const result = CreateQuizSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Título obrigatório')
  })

  it('should reject title with 201 characters', () => {
    const result = CreateQuizSchema.safeParse({ title: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('should accept title with exactly 200 characters', () => {
    const result = CreateQuizSchema.safeParse({ title: 'a'.repeat(200) })
    expect(result.success).toBe(true)
  })

  it('should accept optional description', () => {
    const result = CreateQuizSchema.safeParse({
      title: 'Título',
      description: 'Descrição do quiz',
    })
    expect(result.success).toBe(true)
  })

  it('should accept missing description', () => {
    const result = CreateQuizSchema.safeParse({ title: 'Título' })
    expect(result.success).toBe(true)
  })
})

describe('CreateQuestionSchema', () => {
  it('should accept valid data with defaults', () => {
    const result = CreateQuestionSchema.safeParse({ text: 'Qual é a capital do Brasil?' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.timeLimitSecs).toBe(30)
      expect(result.data.points).toBe(1000)
    }
  })

  it('should reject empty text', () => {
    const result = CreateQuestionSchema.safeParse({ text: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Texto obrigatório')
  })

  it('should reject timeLimitSecs below 5', () => {
    const result = CreateQuestionSchema.safeParse({ text: 'Pergunta', timeLimitSecs: 4 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Mínimo 5 segundos')
  })

  it('should reject timeLimitSecs above 120', () => {
    const result = CreateQuestionSchema.safeParse({ text: 'Pergunta', timeLimitSecs: 121 })
    expect(result.success).toBe(false)
  })

  it('should accept timeLimitSecs at boundary values', () => {
    expect(CreateQuestionSchema.safeParse({ text: 'Pergunta', timeLimitSecs: 5 }).success).toBe(true)
    expect(CreateQuestionSchema.safeParse({ text: 'Pergunta', timeLimitSecs: 120 }).success).toBe(true)
  })

  it('should reject points below 100', () => {
    const result = CreateQuestionSchema.safeParse({ text: 'Pergunta', points: 99 })
    expect(result.success).toBe(false)
  })
})

describe('CreateOptionSchema', () => {
  it('should accept valid option', () => {
    const result = CreateOptionSchema.safeParse({
      text: 'Brasília',
      isCorrect: true,
      color: 'BLUE',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid color', () => {
    const result = CreateOptionSchema.safeParse({
      text: 'Brasília',
      isCorrect: true,
      color: 'PURPLE',
    })
    expect(result.success).toBe(false)
  })

  it('should reject empty text', () => {
    const result = CreateOptionSchema.safeParse({ text: '', isCorrect: false, color: 'RED' })
    expect(result.success).toBe(false)
  })
})

describe('LoginSchema', () => {
  it('should accept valid email and password', () => {
    const result = LoginSchema.safeParse({
      email: 'professor@escola.com.br',
      password: 'senha123',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid email format', () => {
    const result = LoginSchema.safeParse({ email: 'nao-e-email', password: 'senha123' })
    expect(result.success).toBe(false)
  })

  it('should reject empty password', () => {
    const result = LoginSchema.safeParse({ email: 'professor@escola.com.br', password: '' })
    expect(result.success).toBe(false)
  })
})
