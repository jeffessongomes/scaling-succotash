import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '../test/test-utils'
import { useMediaQuery } from './useMediaQuery'

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []

  const mediaQueryList = {
    matches,
    addEventListener: vi.fn((_event: string, listener: (e: MediaQueryListEvent) => void) => {
      listeners.push(listener)
    }),
    removeEventListener: vi.fn((_event: string, listener: (e: MediaQueryListEvent) => void) => {
      const index = listeners.indexOf(listener)
      if (index > -1) listeners.splice(index, 1)
    }),
    dispatchChange: (newMatches: boolean) => {
      listeners.forEach((l) => l({ matches: newMatches } as MediaQueryListEvent))
    },
  }

  vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQueryList as unknown as MediaQueryList)

  return mediaQueryList
}

describe('useMediaQuery', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return false initially when query does not match', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    expect(result.current).toBe(false)
  })

  it('should return true initially when query matches', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    expect(result.current).toBe(true)
  })

  it('should update when media query changes to match', () => {
    const mql = mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    expect(result.current).toBe(false)

    act(() => {
      mql.dispatchChange(true)
    })

    expect(result.current).toBe(true)
  })

  it('should remove event listener on unmount', () => {
    const mql = mockMatchMedia(false)
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    unmount()

    expect(mql.removeEventListener).toHaveBeenCalledOnce()
  })
})
