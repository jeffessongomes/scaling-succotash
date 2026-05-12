export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  QUIZZES: '/quizzes',
  QUIZ_CREATE: '/quizzes/create',
  QUIZ_DETAIL: (id: string) => `/quizzes/${id}`,
  QUIZ_HOST: (id: string) => `/quizzes/${id}/host`,
  GAME_JOIN: '/game/join',
  GAME_PLAY: (pin: string) => `/game/play/${pin}`,
  GAME_DISPLAY: (pin: string) => `/game/display/${pin}`,
} as const
