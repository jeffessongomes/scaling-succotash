import { auth } from '@/lib/auth'
import { ROUTES } from '@/constants/routes'

export default auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL(ROUTES.LOGIN, req.url))
  }
})

export const config = {
  matcher: ['/dashboard/:path*', '/quizzes/:path*'],
}
