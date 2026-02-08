
# デプロイ (公開) 手順

Webアプリとして公開する方法は2通りあります。

## 方法1: GitHub Pages (推奨)
GitHubにこのコードをアップロード（プッシュ）して、GitHub Pages機能をオンにするだけで公開できます。更新もコマンド一つで楽です。

### 手順
1. **GitHubにプッシュする** (私が代行します)
    - 変更内容は自動的にGitHubのリポジトリに反映されます。

2. **GitHub Pagesの設定をオンにする**
    - ブラウザでGitHubのリポジトリページを開きます: [https://github.com/ken96t848-creator/bremen-shift](https://github.com/ken96t848-creator/bremen-shift)
    - 上部のタブから **「Settings」** をクリックします。
    - 左サイドバーの **「Pages」** をクリックします。
    - **「Build and deployment」** の **「Source」** で **「Deploy from a branch」** を選択します。
    - **「Branch」** で **「main」** を選択き、**「/ (root)」** のフォルダを選んで **「Save」** を押します。

3. **公開URLを確認する**
    - 数分待つと、同ページに公開URLが表示されます (例: `https://ken96t848-creator.github.io/bremen-shift/`)。
    - そのURLにアクセスすればアプリが使えます。

### 注意事項 (クラウド同期)
- アプリのデータ保存機能（クラウド同期）を使うには、別途GASのWebアプリURLが必要です。
- 以前設定したURL (`https://script.google.com/...`) があればそのまま使えます。
- もし未設定の場合は、「方法2」の手順でGASを作成し、そのURLをアプリ内の「設定」に入力してください。

---

## 方法2: Google Apps Script (GAS) 直接公開
GitHubを使わず、Google Apps Script自体でWebページを表示する方法です。

### 1. プロジェクトの作成
1. [Google Apps Script](https://script.google.com/) にアクセスします。
2. 「新しいプロジェクト」をクリックします。
3. プロジェクト名を「Bremen Shift」などに変更します。

### 2. ファイルの作成とコピペ
プロジェクト内の `gas_deployment` フォルダにあるファイルをGASにコピペします。

| ファイル名 | 種類 | 内容 |
| :--- | :--- | :--- |
| **Code.gs** | スクリプト | `gas_deployment/Code.gs` の中身をコピペ |
| **index.html** | HTML | `gas_deployment/index.html` の中身をコピペ |
| **javascript.html** | HTML | `gas_deployment/javascript.html` の中身をコピペ |
| **stylesheet.html** | HTML | `gas_deployment/stylesheet.html` の中身をコピペ |

### 3. デプロイ (公開)
1. 画面右上の **「デプロイ」** → **「新しいデプロイ」**。
2. 種類: **「ウェブアプリ」**。
3. 設定:
    *   **次のユーザーとして実行**: **「自分」**
    *   **アクセスできるユーザー**: **「全員」**
4. **「デプロイ」** を押し、URLをコピーします。

これで完了です。
