import { create } from 'zustand'
import { User } from '@prisma/client';

interface UserStore {
    user: User;
    setUser: (user: User) => void
    clearUser: () => void
}
const emptyUser = {
    id: '',
    email: '',
    createdAt: new Date(),
    updatedAt: new Date(),
}

export const useUserStore = create<UserStore>((set) => ({
    user: emptyUser,
    setUser: (user) => set({ user }),
    clearUser: () => set({ user: emptyUser }),
}))