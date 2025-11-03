# KAMUI 4D 運用マニュアル

**KAMUI 4D** = 4層並列実装システム（worktree × tmux × Claude × Codex）

## コア概念

```
D1: 設計/仕様     ← nvim で仕様・TODO・ドキュメント編集
D2: 生成/編集     ← Claude Code で差分生成・コード編集
D3: 実行/検証     ← Codex CLI で並列ビルド・テスト・ラン
D4: 運用/外部UI   ← Atlas/Fly.io/ログ監視
```

**片手で生成・もう片手でビルド＆テスト・足でデプロイ**の姿勢。

---

## 起動

```zsh
cd /Users/koichinishizuka/Desktop/Spell
./kamui-4d-start.sh
```

tmux ウィンドウ構成：

- `D1-Spec`  : nvim で仕様編集
- `D2-Claude`: Claude Code（main ブランチ）
- `D3-Test`  : 3ペイン分割で並列テスト
  - ペイン1: main
  - ペイン2: feature/api-optimization
  - ペイン3: feature/wasm-runtime
- `D4-Ops`   : デプロイ・運用ログ

---

## 基本操作

### tmux キーバインド

```zsh
Ctrl-b c     # 新規ウィンドウ
Ctrl-b n/p   # 次/前のウィンドウ
Ctrl-b 0-9   # ウィンドウ番号でジャンプ
Ctrl-b %     # 垂直分割
Ctrl-b "     # 水平分割
Ctrl-b o     # ペイン移動
Ctrl-b x     # ペイン削除
Ctrl-b d     # デタッチ（バックグラウンド化）
```

デタッチ後の再アタッチ：

```zsh
tmux attach -t kamui
```

---

## Codex CLI 標準コマンド（`.codex.yaml`）

### 単体コマンド

```zsh
codex test      # テスト実行
codex build     # リリースビルド
codex dev       # 開発サーバー（watch モード）
codex deploy    # Fly.io デプロイ
codex lint      # clippy + fmt チェック
codex migrate   # DB マイグレーション
```

### ワークフロー

```zsh
codex exec ci    # フル CI（migrate → lint → test → build）
codex exec ship  # 即デプロイ（test → build → deploy）
```

---

## 並列実装フロー

### パターン1: 3ブランチ同時テスト駆動

1. **D1** で TODO を箇条書き（例：`- [ ] API rate limit 実装`）
2. **D2** で main ブランチのコードを Claude で生成
3. **D3** の各ペインで並列実行：
   ```zsh
   # ペイン1（main）
   codex test

   # ペイン2（api-opt）
   cd ../Spell-worktrees/api-optimization
   codex test

   # ペイン3（wasm-rt）
   cd ../Spell-worktrees/wasm-runtime
   codex test
   ```
4. **失敗したブランチだけ D2 で修正 → 再テスト**
5. **全部通ったら D4 でデプロイ**

### パターン2: 機能ごとに worktree を追加

```zsh
cd /Users/koichinishizuka/Desktop/Spell

# 新機能ブランチを worktree で展開
git worktree add ../Spell-worktrees/new-feature feature/new-feature

# D3 にペインを追加して並列テスト
tmux split-window -h -t kamui:D3-Test
tmux send-keys "cd ../Spell-worktrees/new-feature && codex test" C-m
```

---

## トラブルシューティング

### `codex: command not found`

```zsh
# Codex が入ってるか確認
codex --version

# PATH が通ってるか確認
echo $PATH | grep -o '.cargo/bin'

# ダメなら再インストール
cargo install codex-cli
```

### `claude: node: not found`

→ **旧 Node 版の残骸**。ネイティブ版に切り替え済みなので無視してOK。

### tmux セッションが残ってる

```zsh
# 一覧確認
tmux ls

# 強制削除
tmux kill-session -t kamui
```

### worktree が prunable になってる

```zsh
# 不要な worktree を削除
git worktree prune
```

---

## アドバンス運用

### D3 で watch モード（自動再テスト）

```zsh
# D3 の各ペインで
codex exec watch-test  # ← .codex.yaml に追加すれば自動化
```

### D2 で複数 Claude インスタンス起動

```zsh
# 別ウィンドウで別ブランチを Claude で編集
tmux new-window -t kamui -n "D2-API"
tmux send-keys "cd ../Spell-worktrees/api-optimization && claude code ." C-m
```

### D4 で Atlas UI を開く

```zsh
# Chrome DevTools MCP で自動化
open http://localhost:8000/atlas
```

---

## まとめ

- **KAMUI 4D は"構え"が9割**
- **worktree × tmux × Claude × Codex を常時開きっぱなし**
- **機能ブロックの並列実装が素で回る**
- **D3 側の標準コマンド（`.codex.yaml`）を決めると、サブエージェントへの丸投げも気持ちいい**

次のステップ：
1. D3 の watch モードを `.codex.yaml` に追加
2. D4 に Atlas/Sentry/Datadog ダッシュボードを統合
3. GitHub Actions で `codex exec ci` を自動実行

---

**構え → 回す → 加速する。**
