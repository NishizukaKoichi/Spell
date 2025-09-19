import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Spell, Cast, Wizard } from "./types"
import { resolveUrl } from "./session"

interface MarketplaceStats {
  totalSpells: number
  totalExecutions: number
  averageRating: number
  activeDevelopers: number
}

interface SpellStore {
  // State
  spells: Spell[]
  isFetchingSpells: boolean
  purchasedSpells: Spell[]
  mySpells: Spell[]
  casts: Cast[]
  wizards: Wizard[]
  stats: MarketplaceStats

  // UI State
  activeTab: "bazaar" | "grimoire" | "wizards"
  grimoireTab: "purchased" | "casting" | "creation"
  searchQuery: string
  selectedCategory: string
  selectedMode: "workflow" | "service" | "clone" | "all"

  // Actions
  setActiveTab: (tab: "bazaar" | "grimoire" | "wizards") => void
  setGrimoireTab: (tab: "purchased" | "casting" | "creation") => void
  setSearchQuery: (query: string) => void
  setSelectedCategory: (category: string) => void
  setSelectedMode: (mode: "workflow" | "service" | "clone" | "all") => void

  // Spell Actions
  downloadSpell: (spellId: number) => void
  registerSpell: (spellId: number) => void
  unregisterSpell: (spellId: number) => void
  executeSpell: (spellId: number) => void
  castSpell: (spellId: number, input: any) => Promise<Cast>
  createSpell: (spell: Omit<Spell, "id" | "created_at">) => void
  updateSpell: (spellId: number, patch: Partial<Spell>) => void
  deleteSpell: (spellId: number) => void
  updateStats: () => void

  // Data fetching
  fetchBazaarSpells: () => Promise<void>
  fetchMySpells: () => Promise<void>
  fetchWizards: () => Promise<void>

  // Getters
  getFilteredBazaarSpells: () => Spell[]
  getRegisteredSpells: () => Spell[]
}

export const useSpellStore = create<SpellStore>()(
  persist(
    (set, get) => ({
      // Initial State
      spells: [],
      isFetchingSpells: false,
      purchasedSpells: [],
      mySpells: [],
      casts: [],
      wizards: [],
      stats: {
        totalSpells: 0,
        totalExecutions: 0,
        averageRating: 0,
        activeDevelopers: 0,
      },

      // UI State
      activeTab: "bazaar",
      grimoireTab: "purchased",
      searchQuery: "",
      selectedCategory: "すべて",
      selectedMode: "all",

      // Actions
      setActiveTab: (tab) => set({ activeTab: tab }),
      setGrimoireTab: (tab) => set({ grimoireTab: tab }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedCategory: (category) => set({ selectedCategory: category }),
      setSelectedMode: (mode) => set({ selectedMode: mode }),

      // Spell Actions
      downloadSpell: (spellId) => {
        const spell = get().spells.find((s) => s.id === spellId)
        if (spell && !get().purchasedSpells.find((s) => s.id === spellId)) {
          set((state) => ({
            purchasedSpells: [...state.purchasedSpells, spell],
          }))
        }
      },

      registerSpell: (spellId) => {
        const spell = get().purchasedSpells.find((s) => s.id === spellId)
        if (spell && !get().mySpells.find((s) => s.id === spellId)) {
          set((state) => ({
            mySpells: [...state.mySpells, spell],
          }))
        }
      },

      unregisterSpell: (spellId) => {
        set((state) => ({
          mySpells: state.mySpells.filter((s) => s.id !== spellId),
        }))
      },

      executeSpell: (spellId) => {
        set((state) => ({
          spells: state.spells.map((spell) =>
            spell.id === spellId
              ? {
                  ...spell,
                  executions: (spell.executions ?? spell.stats?.executions ?? 0) + 1,
                  stats: spell.stats
                    ? {
                        ...spell.stats,
                        executions: spell.stats.executions + 1,
                      }
                    : undefined,
                }
              : spell,
          ),
        }))
        get().updateStats()
      },

      castSpell: async (spellId, input) => {
        // 実際のAPI呼び出しをシミュレート
        const cast: Cast = {
          id: Date.now(),
          tenant_id: 1,
          spell_id: spellId,
          caster_user_id: 1,
          run_id: `run_${Date.now()}`,
          idempotency_key: `idem_${Date.now()}`,
          mode: get().spells.find((s) => s.id === spellId)?.execution_mode || "service",
          status: "queued",
          estimate_cents: 5000,
          cost_cents: 0,
          region: "auto",
          input_hash: "hash123",
          p95_ms: 0,
          error_rate: 0,
          created_at: new Date().toISOString(),
        }

        set((state) => ({
          casts: [...state.casts, cast],
        }))

        get().executeSpell(spellId)
        return cast
      },

      createSpell: (spellData) => {
        const newSpell: Spell = {
          ...spellData,
          id: Date.now(),
          created_at: new Date().toISOString(),
          status: spellData.status ?? 'draft',
        }
        set((state) => ({
          mySpells: [...state.mySpells, newSpell],
        }))
        set((state) => ({ spells: [...state.spells, newSpell] }))
        get().updateStats()
      },

      updateSpell: (spellId, patch) => {
        set((state) => ({
          spells: state.spells.map((spell) => (spell.id === spellId ? { ...spell, ...patch } : spell)),
          mySpells: state.mySpells.map((spell) => (spell.id === spellId ? { ...spell, ...patch } : spell)),
        }))
        get().updateStats()
      },

      deleteSpell: (spellId) => {
        set((state) => ({
          spells: state.spells.filter((spell) => spell.id !== spellId),
          mySpells: state.mySpells.filter((spell) => spell.id !== spellId),
          casts: state.casts.filter((cast) => cast.spell_id !== spellId),
        }))
        get().updateStats()
      },

      updateStats: () => {
        const spells = get().spells
        const ratings = spells.filter((spell) => typeof spell.rating === 'number').map((spell) => spell.rating ?? 0)
        set({
          stats: {
            totalSpells: spells.length,
            totalExecutions: spells.reduce((sum, spell) => sum + (spell.executions ?? spell.stats?.executions ?? 0), 0),
            averageRating: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0,
            activeDevelopers: new Set(get().wizards.map((wizard) => wizard.github_username)).size,
          },
        })
      },

      // Data fetching (現在はモック)
      fetchBazaarSpells: async () => {
        set({ isFetchingSpells: true })
        try {
          const res = await fetch(resolveUrl('/api/v1/spells'), {
            credentials: 'include',
            cache: 'no-store',
          })
          if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(`Failed to fetch spells: ${res.status} ${text}`)
          }
          const data = (await res.json()) as { items?: Spell[] }
          const items = Array.isArray(data.items) ? data.items : []
          set({ spells: items })
          get().updateStats()
        } catch (err) {
          console.error('fetchBazaarSpells failed', err)
        } finally {
          set({ isFetchingSpells: false })
        }
      },

      fetchMySpells: async () => {
        try {
          const res = await fetch(resolveUrl('/api/v1/spells?owned=1'), {
            credentials: 'include',
            cache: 'no-store',
          })
          if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(`Failed to fetch my spells: ${res.status} ${text}`)
          }
          const data = (await res.json()) as { items?: Spell[] }
          set({ mySpells: Array.isArray(data.items) ? data.items : [] })
        } catch (err) {
          console.error('fetchMySpells failed', err)
        }
      },


      fetchWizards: async () => {
        // 実際のAPI呼び出し: GET /v1/wizards
        // set({ wizards: response.items })
      },

      // Getters
      getFilteredBazaarSpells: () => {
        const { spells, searchQuery, selectedCategory, selectedMode } = get()
        let filtered = spells.filter((spell) => spell.status === "published")

        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          filtered = filtered.filter(
            (spell) =>
              spell.name.toLowerCase().includes(query) ||
              spell.summary.toLowerCase().includes(query) ||
              spell.spell_key.toLowerCase().includes(query),
          )
        }

        if (selectedMode !== "all") {
          filtered = filtered.filter((spell) => spell.execution_mode === selectedMode)
        }

        const now = Date.now()
        if (selectedCategory && selectedCategory !== "すべて") {
          if (selectedCategory === "新着") {
            filtered = filtered.filter((spell) => {
              const published = Date.parse(spell.published_at ?? spell.created_at)
              return Number.isFinite(published) && now - published <= 7 * 24 * 60 * 60 * 1000
            })
          } else if (selectedCategory === "人気") {
            filtered = filtered.filter((spell) => (spell.stats?.executions ?? 0) > 0)
          } else if (selectedCategory === "ワークフロー") {
            filtered = filtered.filter((spell) => spell.execution_mode === "workflow")
          } else if (selectedCategory === "サービス") {
            filtered = filtered.filter((spell) => spell.execution_mode === "service")
          } else if (selectedCategory === "テンプレート") {
            filtered = filtered.filter((spell) => spell.execution_mode === "clone")
          }
        }

        return filtered
      },

      getRegisteredSpells: () => {
        return get().mySpells.filter((spell) => get().purchasedSpells.some((p) => p.id === spell.id))
      },
    }),
    {
      name: "spell-store-v2",
    },
  ),
)
