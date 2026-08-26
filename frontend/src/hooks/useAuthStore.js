import { create } from 'zustand'

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('pos_user') || 'null'),
  token: localStorage.getItem('pos_token') || null,
  isAuthenticated: !!localStorage.getItem('pos_token'),

  login: (user, token) => {
    localStorage.setItem('pos_token', token)
    localStorage.setItem('pos_user', JSON.stringify(user))
    set({ user, token, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('pos_token')
    localStorage.removeItem('pos_user')
    set({ user: null, token: null, isAuthenticated: false })
  },

  updateUser: (updatedUser) => {
    localStorage.setItem('pos_user', JSON.stringify(updatedUser))
    set({ user: updatedUser })
  },
}))

export default useAuthStore
