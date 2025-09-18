# PlanetScale スキーマ

`schema.sql` には本リポジトリが想定する PlanetScale (MySQL) のベーステーブルが含まれます。`

## 適用方法

1. PlanetScale CLI でスキーマブランチを作成します。
   ```bash
   pscale branch create spell-platform main local-setup
   ```
2. `schema.sql` を適用します。
   ```bash
   pscale shell spell-platform local-setup < db/schema.sql
   ```
3. 生成されたブランチに対して `pscale deploy-request create` を実行し、本番ブランチへマージします。

## 注意点

- テーブルはアプリケーション側で外部キーを扱う前提のため、database レベルでは外部キー制約を定義していません。
- `casts.idempotency_key` や `billing_ledger.external_id` にユニーク制約を設けているため、アプリの冪等性ロジックと一致します。
- 既存環境で追加変更がある場合は PlanetScale の Deploy Request を使い、互換性の無い変更は 2 フェーズで実施してください。

