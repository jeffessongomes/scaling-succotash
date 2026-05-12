export interface AnswerOptionPublic {
  id: string
  questionId: string
  text: string
  isCorrect: boolean
  color: 'RED' | 'BLUE' | 'YELLOW' | 'GREEN'
  order: number
}
