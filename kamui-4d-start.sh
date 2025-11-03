#!/bin/zsh
# KAMUI 4D tmux セットアップスクリプト

SESSION="kamui"
MAIN_DIR="/Users/koichinishizuka/Desktop/Spell"
API_OPT_DIR="/Users/koichinishizuka/Desktop/Spell-worktrees/api-optimization"
WASM_RT_DIR="/Users/koichinishizuka/Desktop/Spell-worktrees/wasm-runtime"

# 既存セッションがあれば削除
tmux has-session -t $SESSION 2>/dev/null && tmux kill-session -t $SESSION

# 新規セッション作成
tmux new-session -d -s $SESSION -n "D1-Spec"

# D1: 仕様/設計（上段左）
tmux send-keys -t $SESSION:D1-Spec "cd $MAIN_DIR && echo '=== D1: Spec/Design ===' && cat README.md | head -20" C-m

# D2: Claude Code 生成/編集（上段右）
tmux new-window -t $SESSION -n "D2-Claude"
tmux send-keys -t $SESSION:D2-Claude "cd $MAIN_DIR && echo '=== Claude Code 起動 (main) ===' && claude code ." C-m

# D3: Codex 実行/検証（下段左 - 3ペイン分割）
tmux new-window -t $SESSION -n "D3-Test"

# D3-1: main ブランチテスト
tmux send-keys -t $SESSION:D3-Test "cd $MAIN_DIR && echo '=== D3-1: main branch ===' && codex test" C-m

# D3-2: api-optimization テスト（水平分割）
tmux split-window -v -t $SESSION:D3-Test
tmux send-keys -t $SESSION:D3-Test "cd $API_OPT_DIR && echo '=== D3-2: api-optimization ===' && codex test" C-m

# D3-3: wasm-runtime テスト（垂直分割）
tmux split-window -h -t $SESSION:D3-Test
tmux send-keys -t $SESSION:D3-Test "cd $WASM_RT_DIR && echo '=== D3-3: wasm-runtime ===' && codex test" C-m

# D4: 運用/Atlas（下段右）
tmux new-window -t $SESSION -n "D4-Ops"
tmux send-keys -t $SESSION:D4-Ops "cd $MAIN_DIR && echo '=== D4: Atlas / Deployment Logs ==='" C-m

# デフォルトウィンドウを D2 に設定
tmux select-window -t $SESSION:D2-Claude

# アタッチ
tmux attach -t $SESSION
