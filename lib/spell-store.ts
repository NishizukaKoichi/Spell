import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Spell, Cast, Wizard, User } from "./types"

interface SpellStore {
  // State
  currentUser: User | null
  spells: Spell[]
  purchasedSpells: Spell[]
  mySpells: Spell[]
  casts: Cast[]
  wizards: Wizard[]

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
  castSpell: (spellId: number, input: any) => Promise<Cast>
  createSpell: (spell: Omit<Spell, "id" | "created_at">) => void

  // Data fetching
  fetchBazaarSpells: () => Promise<void>
  fetchMySpells: () => Promise<void>
  fetchWizards: () => Promise<void>

  // Getters
  getFilteredBazaarSpells: () => Spell[]
  getRegisteredSpells: () => Spell[]
}

// サンプルデータ
const sampleSpells: Spell[] = [
  {
    id: 1,
    tenant_id: 1,
    spell_key: "com.example.pdf-generator",
    name: "PDF生成API",
    summary: "HTMLからPDFを生成する高性能なAPI。カスタムテンプレート対応、日本語フォント完全サポート。",
    visibility: "public",
    execution_mode: "service",
    pricing_json: {
      model: "flat",
      currency: "JPY",
      amount_cents: 50000,
    },
    input_schema_json: {
      type: "object",
      properties: {
        html: { type: "string" },
        options: { type: "object" },
      },
    },
    status: "published",
    published_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    author: {
      name: "DevTeam",
      avatar: "/developer-working.png",
    },
    stats: {
      executions: 1234,
      success_rate: 0.98,
      avg_runtime_ms: 2500,
    },
  },
  {
    id: 2,
    tenant_id: 1,
    spell_key: "com.example.image-optimizer",
    name: "画像最適化バッチ",
    summary: "複数画像の一括最適化。WebP変換、リサイズ、圧縮を自動実行。CI/CDパイプライン対応。",
    visibility: "public",
    execution_mode: "workflow",
    pricing_json: {
      model: "metered",
      currency: "JPY",
      amount_cents: 10000,
    },
    input_schema_json: {
      type: "object",
      properties: {
        images: { type: "array" },
        format: { type: "string" },
      },
    },
    status: "published",
    published_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    author: {
      name: "ImagePro",
      avatar: "/photographer.png",
    },
    stats: {
      executions: 892,
      success_rate: 0.99,
      avg_runtime_ms: 15000,
    },
  },
  {
    id: 3,
    tenant_id: 1,
    spell_key: "com.example.data-analysis",
    name: "データ分析テンプレート",
    summary: "Pythonベースのデータ分析環境。Jupyter Notebook、pandas、matplotlib込み。",
    visibility: "public",
    execution_mode: "clone",
    pricing_json: {
      model: "one_time",
      currency: "JPY",
      amount_cents: 80000,
    },
    input_schema_json: {
      type: "object",
      properties: {
        repo_name: { type: "string" },
        description: { type: "string" },
      },
    },
    status: "published",
    published_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    author: {
      name: "Analytics",
      avatar: "/data-analyst-workspace.png",
    },
    stats: {
      executions: 567,
      success_rate: 0.97,
      avg_runtime_ms: 5000,
    },
  },
]

const sampleWizards: Wizard[] = [
  {
    id: 1,
    name: "DevTeam",
    avatar: "/developer-working.png",
    bio: "エンタープライズ向けAPI開発チーム。高品質で信頼性の高いSpellを提供します。",
    github_username: "devteam-official",
    published_spells: 12,
    total_executions: 15420,
    success_rate: 0.98,
    joined_at: "2024-01-15",
  },
  {
    id: 2,
    name: "ImagePro",
    avatar: "/photographer.png",
    bio: "画像処理・メディア変換のスペシャリスト。CI/CD統合に特化したワークフローを開発。",
    github_username: "imagepro-tools",
    published_spells: 8,
    total_executions: 8920,
    success_rate: 0.99,
    joined_at: "2024-02-20",
  },
  {
    id: 3,
    name: "Analytics",
    avatar: "/data-analyst-workspace.png",
    bio: "データサイエンス・機械学習のテンプレート開発者。研究機関との連携多数。",
    github_username: "analytics-lab",
    published_spells: 15,
    total_executions: 12340,
    success_rate: 0.97,
    joined_at: "2024-01-08",
  },
]

export const useSpellStore = create<SpellStore>()(
  persist(
    (set, get) => ({
      // Initial State
      currentUser: null,
      spells: sampleSpells,
      purchasedSpells: [],
      mySpells: [],
      casts: [],
      wizards: sampleWizards,

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

        return cast
      },

      createSpell: (spellData) => {
        const newSpell: Spell = {
          ...spellData,
          id: Date.now(),
          created_at: new Date().toISOString(),
        }
        set((state) => ({
          mySpells: [...state.mySpells, newSpell],
        }))
      },

      // Data fetching (現在はモック)
      fetchBazaarSpells: async () => {
        // 実際のAPI呼び出し: GET /v1/spells
        // set({ spells: response.items })
      },

      fetchMySpells: async () => {
        // 実際のAPI呼び出し: GET /v1/spells?author=me
        // set({ mySpells: response.items })
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
