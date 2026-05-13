import { io } from 'socket.io-client'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export const socket = io(WS_URL, {
  autoConnect: false,
  transports: ['websocket'],
})

export const gameSocket = io(`${WS_URL}/game`, {
  autoConnect: false,
  transports: ['websocket'],
})
