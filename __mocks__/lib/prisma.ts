import { jest } from '@jest/globals'

const createPrismaMock = () => ({
  spell: {
    findUnique: jest.fn()
  },
  billingRecord: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn()
  },
  runeArtifact: {
    findFirst: jest.fn()
  },
  ban: {
    findUnique: jest.fn()
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn()
  },
  stripeWebhookEvent: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
})

const prisma = createPrismaMock()

export const resetPrismaMock = () => {
  prisma.spell.findUnique.mockReset()
  prisma.billingRecord.create.mockReset()
  prisma.billingRecord.findFirst.mockReset()
  prisma.billingRecord.update.mockReset()
  prisma.runeArtifact.findFirst.mockReset()
  prisma.ban.findUnique.mockReset()
  prisma.user.findUnique.mockReset()
  prisma.user.update.mockReset()
  prisma.user.updateMany.mockReset()
  prisma.stripeWebhookEvent.findUnique.mockReset()
  prisma.stripeWebhookEvent.create.mockReset()
  prisma.stripeWebhookEvent.update.mockReset()
}

export { prisma }
