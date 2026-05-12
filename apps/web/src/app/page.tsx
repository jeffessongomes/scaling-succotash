export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-5xl font-bold">Azimute</h1>
      <p className="text-xl text-gray-600">Quiz interativo para viagens escolares</p>
      <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-500">
        {process.env.NODE_ENV}
      </span>
      <a className="text-blue-600 hover:underline" href="/login">
        Entrar
      </a>
    </main>
  )
}
