# KAMUI 4D クイックスタート

## 5分で始める並列実装環境

### 1. 環境チェック

```zsh
# 必須ツールの確認
codex --version   # codex-cli 0.52.0
claude --version  # 2.0.31 (Claude Code)
git --version
tmux -V

# worktree 状態確認
cd /Users/koichinishizuka/Desktop/Spell
git worktree list
```

期待する出力：

```
/Users/koichinishizuka/Desktop/Spell                             3a44502 [main]
/Users/koichinishizuka/Desktop/Spell-worktrees/api-optimization  3a44502 [feature/api-optimization]
/Users/koichinishizuka/Desktop/Spell-worktrees/wasm-runtime      3a44502 [feature/wasm-runtime]
```

---

### 2. KAMUI 4D 起動

```zsh
cd /Users/koichinishizuka/Desktop/Spell
./kamui-4d-start.sh
```

tmux セッション `kamui` が起動し、以下のウィンドウが開きます：

- `D1-Spec`  : README.md 編集（nvim）
- `D2-Claude`: Claude Code（main）
- `D3-Test`  : 3ペイン並列テスト（main / api-opt / wasm-rt）
- `D4-Ops`   : 運用ログ

**ウィンドウ切り替え**: `Ctrl-b n` (次) / `Ctrl-b p` (前) / `Ctrl-b 0-3` (番号指定)

---

### 3. 並列テスト実行

`D3-Test` ウィンドウに移動（`Ctrl-b 2`）して、各ペインで：

```zsh
# ペイン1（main） - 既に実行済み
codex test

# ペイン間の移動: Ctrl-b o

# ペイン2（api-optimization）
codex test

# ペイン3（wasm-runtime）
codex test
```

**全部同時に実行してOK**。worktree のおかげでファイルロック競合が起きません。

---

### 4. Claude Code で差分生成

`D2-Claude` ウィンドウに移動（`Ctrl-b 1`）：

```zsh
# Claude Code が起動済み。そのままプロンプト入力

👤: Add rate limiting middleware to API routes

🤖: (コード生成...)
```

生成後、`D3-Test` でテストを再実行して確認。

---

### 5. デプロイ

`D4-Ops` ウィンドウに移動（`Ctrl-b 3`）：

```zsh
codex deploy
```

または、ワークフロー実行：

```zsh
codex exec ship  # test → build → deploy を一気に実行
```

---

## 次のステップ

### worktree を追加

新しい機能ブランチを並列で開発：

```zsh
cd /Users/koichinishizuka/Desktop/Spell

# 新ブランチ作成
git checkout -b feature/new-auth main

# worktree に展開
git worktree add ../Spell-worktrees/new-auth feature/new-auth

# D3 にペイン追加
tmux split-window -h -t kamui:D3-Test
tmux send-keys "cd ../Spell-worktrees/new-auth && codex test" C-m
```

### watch モード追加

`.codex.yaml` に追加：

```yaml
commands:
  watch:
    description: "Watch and auto-test"
    run: |
      cargo watch -x test
```

使い方：

```zsh
# D3 の各ペインで
codex watch
```

ファイル変更時に自動でテストが走ります。

---

## トラブルシューティング

### tmux が起動しない

```zsh
# 既存セッションを確認
tmux ls

# 削除
tmux kill-session -t kamui

# 再起動
./kamui-4d-start.sh
```

### codex コマンドが見つからない

```zsh
# PATH 確認
echo $PATH | grep cargo

# なければ追加
export PATH="$HOME/.cargo/bin:$PATH"
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.zshrc
```

### worktree が消えた

```zsh
# 再作成
git worktree add ../Spell-worktrees/api-optimization feature/api-optimization
git worktree add ../Spell-worktrees/wasm-runtime feature/wasm-runtime
```

---

## まとめ

**KAMUI 4D の3原則**：

1. **構える** → `./kamui-4d-start.sh` で4層展開
2. **回す** → D2で生成 → D3で検証 → D4でデプロイ
3. **加速** → worktree追加 + watch モード + CI自動化

詳細は `KAMUI-4D.md` を参照。

---

**次回からは `./kamui-4d-start.sh` 一発で始められます。**
