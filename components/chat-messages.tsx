'use client';
import { Sparkles, BookOpen, Store, Key, Settings, User, WandSparkles } from 'lucide-react';

interface SpellMetadata {
  name: string;
  author: string;
  description?: string;
  category?: string;
  createdAt?: string;
}

interface SelectedItem {
  type: string;
  name: string;
  data?: any;
}

interface ChatMessagesProps {
  selectedSpell?: SpellMetadata | null;
  selectedItem?: SelectedItem | null;
}

export function ChatMessages({ selectedSpell, selectedItem }: ChatMessagesProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'execution':
        return <WandSparkles className="h-8 w-8 text-foreground" />;
      case 'bazaar':
        return <Store className="h-8 w-8 text-foreground" />;
      case 'grimoire':
        return <BookOpen className="h-8 w-8 text-foreground" />;
      case 'password':
        return <Key className="h-8 w-8 text-foreground" />;
      case 'vaults':
        return <Settings className="h-8 w-8 text-foreground" />;
      case 'caster':
        return <User className="h-8 w-8 text-foreground" />;
      default:
        return <Sparkles className="h-8 w-8 text-foreground" />;
    }
  };

  const getDescription = (type: string, name: string) => {
    const descriptions: Record<string, string> = {
      execution: 'スペルを実行して魔法の力を発動させます',
      bazaar: '新しいスペルやアイテムを購入できるマーケットプレイスです',
      'All Spells': '利用可能なすべてのスペルを閲覧できます',
      Purchased: '購入済みのスペルを管理します',
      Favorites: 'お気に入りのスペルにすばやくアクセスできます',
      Unpurchased: 'まだ購入していないスペルを探索します',
      Folders: 'スペルをフォルダで整理します',
      Bookmarks: 'ブックマークしたスペルを表示します',
      password: 'パスワードとセキュリティ設定を管理します',
      Transactions: '過去の取引履歴を確認します',
      Licenses: '所有しているライセンスを管理します',
      Artifacts: '収集したアーティファクトを表示します',
      caster: 'プロフィールとアカウント設定を管理します',
    };
    return descriptions[name] || descriptions[type] || `${name}セクションへようこそ`;
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      {selectedItem && selectedItem.type !== 'execution' ? (
        <div className="max-w-md space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center border border-foreground bg-background">
            {getIcon(selectedItem.type)}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">{selectedItem.name}</h2>
            <p className="text-sm text-muted-foreground">
              {getDescription(selectedItem.type, selectedItem.name)}
            </p>
          </div>
          <div className="space-y-1 border border-foreground bg-background p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">タイプ</span>
              <span className="font-medium text-foreground capitalize">{selectedItem.type}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">ステータス</span>
              <span className="font-medium text-foreground">利用可能</span>
            </div>
          </div>
        </div>
      ) : selectedSpell ? (
        <div className="max-w-md space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center border border-foreground bg-background">
            <Sparkles className="h-8 w-8 text-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">{selectedSpell.name}</h2>
            {selectedSpell.description && (
              <p className="text-sm text-muted-foreground">{selectedSpell.description}</p>
            )}
          </div>
          <div className="space-y-1 border border-foreground bg-background p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">作者</span>
              <span className="font-medium text-foreground">{selectedSpell.author}</span>
            </div>
            {selectedSpell.category && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">カテゴリ</span>
                <span className="font-medium text-foreground">{selectedSpell.category}</span>
              </div>
            )}
            {selectedSpell.createdAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">作成日</span>
                <span className="font-medium text-foreground">{selectedSpell.createdAt}</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
