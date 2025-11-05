export interface SpellMetadata {
  id: string
  name: string
  author: string
  description?: string
  category?: string
  tags?: string[]
  createdAt?: string
  cost?: number
  artifactType?: string
}

export interface ChatInputProps {
  onSendMessage: (message: string) => void
  onSpellSelect?: (spell: SpellMetadata) => void
  disabled?: boolean
  placeholder?: string
}
