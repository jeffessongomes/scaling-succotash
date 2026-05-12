export interface QuestionPublic {
  id: string
  quizId: string
  text: string
  mediaType: 'IMAGE' | 'VIDEO' | null
  mediaUrl: string | null
  timeLimitSecs: number
  points: number
  order: number
  options: AnswerOptionPublic[]
}

export interface AnswerOptionPublic {
  id: string
  questionId: string
  text: string
  isCorrect: boolean
  color: 'RED' | 'BLUE' | 'YELLOW' | 'GREEN'
  order: number
}
