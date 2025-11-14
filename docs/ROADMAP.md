# Spell 実装ロードマップ v1.x

## フェーズ1: Spell Core + ChatGPT 連携（MVP）

- 固定呪文セットで Spell Core（呪文実行エンジン）を構築。
- ChatGPT Apps SDK/MCP で `spell.execute` ツールを公開。
- パスキー認証は外部 IdP + トークンで仮実装。
- 課金はログ記録のみ（実課金なし）。

## フェーズ2: パスキー認証 & 課金本実装

- WebAuthn/Passkey ベースの認証ルートを確立。
- ChatGPT 内決済フローと backend 側 Billing 記録を実装。
- 呪文ごとの価格設定と従量課金を有効化。

## フェーズ3: Rune 導入（クローズドβ）

- 自分用アカウントで Rune を有効化。
- 呪文作成 → Spell Core 登録 → 実行のループを Apps SDK/CLI 双方で検証。
- Rune API/CLI を磨き込み。

## フェーズ4: 信頼スコア／BAN／公開

- 信頼スコア簡易モデルを実装し Rune 公開条件に導入。
- BAN/ブラックリスト機構を構築。
- 限定的な外部ユーザーへの提供を開始。
