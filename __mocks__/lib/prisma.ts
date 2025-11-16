import { jest } from '@jest/globals'

const createPrismaMock = () => ({
  spell: {
    findUnique: jest.fn()
  },
  billingRecord: {
    create: jest.fn()
  },
  runeArtifact: {
    findFirst: jest.fn()
  },
  ban: {
    findUnique: jest.fn()
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn()
  }
})

const prisma = createPrismaMock()

export const resetPrismaMock = () => {
  prisma.spell.findUnique.mockReset()
  prisma.billingRecord.create.mockReset()
  prisma.runeArtifact.findFirst.mockReset()
  prisma.ban.findUnique.mockReset()
  prisma.user.findUnique.mockReset()
  prisma.user.update.mockReset()
}

export { prisma }
