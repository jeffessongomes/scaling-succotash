import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './ui.store'

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({ sidebarOpen: false })
  })

  describe('initial state', () => {
    it('should have sidebarOpen as false', () => {
      const { sidebarOpen } = useUIStore.getState()

      expect(sidebarOpen).toBe(false)
    })
  })

  describe('when setSidebarOpen is called', () => {
    it('should update sidebarOpen to given value', () => {
      const { setSidebarOpen } = useUIStore.getState()

      setSidebarOpen(true)

      expect(useUIStore.getState().sidebarOpen).toBe(true)
    })

    it('should set sidebarOpen to false when called with false', () => {
      useUIStore.setState({ sidebarOpen: true })
      const { setSidebarOpen } = useUIStore.getState()

      setSidebarOpen(false)

      expect(useUIStore.getState().sidebarOpen).toBe(false)
    })
  })

  describe('when toggleSidebar is called', () => {
    it('should flip sidebarOpen from false to true', () => {
      const { toggleSidebar } = useUIStore.getState()

      toggleSidebar()

      expect(useUIStore.getState().sidebarOpen).toBe(true)
    })

    it('should flip sidebarOpen from true to false', () => {
      useUIStore.setState({ sidebarOpen: true })
      const { toggleSidebar } = useUIStore.getState()

      toggleSidebar()

      expect(useUIStore.getState().sidebarOpen).toBe(false)
    })
  })
})
