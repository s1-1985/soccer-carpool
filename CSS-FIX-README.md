# FC尾島ジュニア - 強制CSS修正スクリプト完全版

## 概要

FC尾島ジュニアプロジェクトにおけるCSSの表示問題を解決するための強制修正スクリプトです。

## 機能

### 1. バックアップ作成
- 全CSSファイルのバックアップを自動作成
- HTMLファイルのバックアップも作成
- バックアップファイルは `.backup` 拡張子付きで保存

### 2. CSS修正（!important適用）
- 重要なCSSプロパティに `!important` を自動追加
- ナビゲーション要素の強制修正
- レスポンシブ対応の修正

### 3. public フォルダへの同期
- 修正されたCSSファイルを `public/css` フォルダに同期
- サブディレクトリも含めて完全同期

### 4. HTML への直接 <style> タグ挿入
- 各HTMLファイルに強制CSSを直接挿入
- `<head>` タグ内に `<style>` タグを追加
- 既存の `<style>` タグは置換

### 5. 実行ログの出力
- 詳細な実行ログを `css-fix-log.txt` に出力
- タイムスタンプ付きで全処理を記録

## 使用方法

### Node.js版（推奨）
```bash
node force-css-fix-script.js
```

### Bash版
```bash
./force-css-fix-script.sh
```

## ファイル構成

```
fc-ojima-hub/
├── force-css-fix-script.js    # Node.js版スクリプト
├── force-css-fix-script.sh    # Bash版スクリプト
├── CSS-FIX-README.md          # この説明書
└── css-fix-log.txt           # 実行ログ（実行後に生成）
```

## 修正内容

### 主な修正対象
- `.main-nav` ナビゲーション要素
- `.main-nav ul` リスト要素
- `.main-nav li` リストアイテム
- `.main-nav a` リンク要素

### 追加される強制CSS
```css
/* ナビゲーション強制修正 */
.main-nav ul {
    list-style: none !important;
    display: flex !important;
    flex-direction: row !important;
    padding: 0 !important;
    margin: 0 !important;
    flex-wrap: wrap !important;
}

.main-nav {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    background: rgba(255, 255, 255, 0.95) !important;
    border-radius: 12px !important;
    margin-bottom: 30px !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
    backdrop-filter: blur(10px) !important;
    border: 2px solid rgba(255, 215, 0, 0.3) !important;
}

/* レスポンシブ対応 */
@media screen and (max-width: 768px) {
    .main-nav ul {
        flex-direction: column !important;
    }
    
    .main-nav {
        flex-direction: column !important;
    }
}
```

## 注意事項

### 実行前の確認
1. 必ず現在のファイルのバックアップを取ってください
2. 実行前に Git でコミットしておくことを推奨します
3. テスト環境での実行を推奨します

### 実行後の確認
1. `css-fix-log.txt` でログを確認
2. ブラウザでページの表示を確認
3. レスポンシブ表示の確認

### 復元方法
バックアップファイルを使用して復元：
```bash
# 例: common.css を復元
cp css/common.css.backup css/common.css

# 例: HTMLファイルを復元
cp index.html.backup index.html
```

## トラブルシューティング

### 権限エラー
```bash
chmod +x force-css-fix-script.sh
```

### Node.js がない場合
Bash版を使用してください：
```bash
./force-css-fix-script.sh
```

### ログファイルが見つからない
スクリプトの実行が完了していない可能性があります。再実行してください。

## 対象ファイル

### CSS ファイル
- `css/common.css`
- `css/hub/*.css`
- `css/carpool/*.css`
- `public/css/` 内の全CSSファイル

### HTML ファイル
- プロジェクトルートの全HTMLファイル
- `auth/` フォルダ内の全HTMLファイル
- `hub/` フォルダ内の全HTMLファイル
- `carpool/` フォルダ内の全HTMLファイル
- `public/` フォルダ内の全HTMLファイル

## 実行例

```bash
$ node force-css-fix-script.js

=== FC尾島ジュニア - 強制CSS修正スクリプト完全版 開始 ===
[2025-07-07 12:00:00] INFO: バックアップ作成を開始...
[2025-07-07 12:00:01] SUCCESS: バックアップを作成しました: /home/yasuhiro-sone/fc-ojima-hub/css/common.css.backup
[2025-07-07 12:00:01] SUCCESS: バックアップ作成完了
[2025-07-07 12:00:01] INFO: CSS修正処理を開始...
[2025-07-07 12:00:02] SUCCESS: CSS修正完了: 25 件のプロパティを修正
[2025-07-07 12:00:02] INFO: public フォルダへの同期を開始...
[2025-07-07 12:00:03] SUCCESS: public フォルダへの同期完了
[2025-07-07 12:00:03] INFO: HTML への <style> タグ挿入を開始...
[2025-07-07 12:00:05] SUCCESS: HTML への <style> タグ挿入完了: 15 ファイル処理
[2025-07-07 12:00:05] INFO: === 実行レポート ===
[2025-07-07 12:00:05] INFO: 実行時間: 5234ms
[2025-07-07 12:00:05] INFO: CSS修正数: 25
[2025-07-07 12:00:05] INFO: 処理されたログ数: 18
[2025-07-07 12:00:05] INFO: =================
ログファイルを保存しました: /home/yasuhiro-sone/fc-ojima-hub/css-fix-log.txt
=== 強制CSS修正スクリプト完全版 完了 ===
```

## 更新履歴

- 2025-07-07: 初版作成
  - バックアップ機能
  - CSS修正機能
  - 同期機能
  - HTML挿入機能
  - ログ出力機能