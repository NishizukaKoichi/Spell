'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import {
  Search,
  StoreIcon,
  Scroll,
  Download,
  Tag,
  Zap,
  Plus,
  BookOpen,
  Folder,
  Bookmark,
  FolderPlus,
  Edit2,
  Trash2,
  Wand2,
  Package,
} from 'lucide-react';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Label } from './ui/label';
import { useLanguage } from '@/lib/i18n/language-provider';

interface SpellItem {
  id: string;
  name: string;
  author: string;
  description: string;
  longDescription: string;
  category: string;
  price: number;
  rating: number;
  downloads: number;
  features: string[];
  requirements: string[];
  version: string;
  lastUpdated: string;
  image?: string;
  artifactType?: 'App' | 'Tool' | 'Template' | null; // Added artifactType field
}

interface FolderData {
  id: string;
  name: string;
  spellIds: string[];
  createdAt: string;
}

interface BazaarMarketplaceProps {
  mode?: 'bazaar' | 'grimoire' | 'folders' | 'bookmarks';
  favoritesOnly?: boolean;
}

export function BazaarMarketplace({
  mode = 'bazaar',
  favoritesOnly = false,
}: BazaarMarketplaceProps) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSpell, setSelectedSpell] = useState<SpellItem | null>(null);
  const [displayedSpells, setDisplayedSpells] = useState<SpellItem[]>([]);
  const [allSpells, setAllSpells] = useState<SpellItem[]>([]);
  const [grimoire, setGrimoire] = useState<Set<string>>(new Set());
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<FolderData | null>(null);
  const [showAddToFolderDialog, setShowAddToFolderDialog] = useState(false);
  const [spellToAddToFolder, setSpellToAddToFolder] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [spellToDelete, setSpellToDelete] = useState<string | null>(null);
  const [showDeleteFolderConfirm, setShowDeleteFolderConfirm] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [showRemoveFromFolderConfirm, setShowRemoveFromFolderConfirm] = useState(false);
  const [spellToRemoveFromFolder, setSpellToRemoveFromFolder] = useState<string | null>(null);

  useEffect(() => {
    const storedGrimoire = localStorage.getItem('spell-grimoire');
    if (storedGrimoire) {
      setGrimoire(new Set(JSON.parse(storedGrimoire)));
    }

    const storedFolders = localStorage.getItem('spell-folders');
    if (storedFolders) {
      setFolders(JSON.parse(storedFolders));
    }

    const storedBookmarks = localStorage.getItem('spell-bookmarks');
    if (storedBookmarks) {
      setBookmarks(new Set(JSON.parse(storedBookmarks)));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('spell-grimoire', JSON.stringify(Array.from(grimoire)));
  }, [grimoire]);

  useEffect(() => {
    localStorage.setItem('spell-folders', JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem('spell-bookmarks', JSON.stringify(Array.from(bookmarks)));
  }, [bookmarks]);

  useEffect(() => {
    const initialSpells = [...SAMPLE_SPELLS, ...generateMoreSpells(7, 50)];
    setAllSpells(initialSpells);
  }, []);

  const categories = Array.from(new Set(allSpells.map((spell) => spell.category)));

  const getCategoryTranslation = (category: string) => {
    switch (category) {
      case 'Productivity':
        return t.bazaar.categoryProductivity;
      case 'Creative':
        return t.bazaar.categoryCreative;
      case 'Analytics':
        return t.bazaar.categoryAnalytics;
      case 'Collaboration':
        return t.bazaar.categoryCollaboration;
      default:
        return category;
    }
  };

  const toggleGrimoire = (spellId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setGrimoire((prev) => {
      const newGrimoire = new Set(prev);
      if (newGrimoire.has(spellId)) {
        newGrimoire.delete(spellId);
      } else {
        newGrimoire.add(spellId);
      }
      return newGrimoire;
    });
  };

  const confirmRemoveFromGrimoire = (spellId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSpellToDelete(spellId);
    setShowDeleteConfirm(true);
  };

  const removeFromGrimoire = () => {
    if (spellToDelete) {
      setGrimoire((prev) => {
        const newGrimoire = new Set(prev);
        newGrimoire.delete(spellToDelete);
        return newGrimoire;
      });
      // ブックマークからも削除
      setBookmarks((prev) => {
        const newBookmarks = new Set(prev);
        newBookmarks.delete(spellToDelete);
        return newBookmarks;
      });
      // すべてのフォルダから削除
      setFolders((prev) =>
        prev.map((folder) => ({
          ...folder,
          spellIds: folder.spellIds.filter((id) => id !== spellToDelete),
        }))
      );
    }
    setShowDeleteConfirm(false);
    setSpellToDelete(null);
  };

  const toggleBookmark = (spellId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setBookmarks((prev) => {
      const newBookmarks = new Set(prev);
      if (newBookmarks.has(spellId)) {
        newBookmarks.delete(spellId);
      } else {
        newBookmarks.add(spellId);
      }
      return newBookmarks;
    });
  };

  const createFolder = () => {
    if (!newFolderName.trim()) return;

    if (editingFolder) {
      setFolders((prev) =>
        prev.map((f) => (f.id === editingFolder.id ? { ...f, name: newFolderName.trim() } : f))
      );
      setEditingFolder(null);
    } else {
      const newFolder: FolderData = {
        id: Date.now().toString(),
        name: newFolderName.trim(),
        spellIds: spellToAddToFolder ? [spellToAddToFolder] : [],
        createdAt: new Date().toISOString(),
      };
      setFolders((prev) => [...prev, newFolder]);

      if (spellToAddToFolder) {
        setSpellToAddToFolder(null);
        setShowAddToFolderDialog(false);
      }
    }

    setNewFolderName('');
    setShowFolderDialog(false);
  };

  const confirmDeleteFolder = (folderId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setFolderToDelete(folderId);
    setShowDeleteFolderConfirm(true);
  };

  const deleteFolderConfirmed = () => {
    if (folderToDelete) {
      setFolders((prev) => prev.filter((f) => f.id !== folderToDelete));
      if (selectedFolder === folderToDelete) {
        setSelectedFolder(null);
      }
    }
    setShowDeleteFolderConfirm(false);
    setFolderToDelete(null);
  };

  const addSpellToFolder = (spellId: string, folderId: string) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId && !f.spellIds.includes(spellId)
          ? { ...f, spellIds: [...f.spellIds, spellId] }
          : f
      )
    );
  };

  const removeSpellFromFolder = (spellId: string, folderId: string) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId ? { ...f, spellIds: f.spellIds.filter((id) => id !== spellId) } : f
      )
    );
  };

  const confirmRemoveFromFolder = (spellId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSpellToRemoveFromFolder(spellId);
    setShowRemoveFromFolderConfirm(true);
  };

  const removeFromFolderConfirmed = () => {
    if (spellToRemoveFromFolder && selectedFolder) {
      removeSpellFromFolder(spellToRemoveFromFolder, selectedFolder);
    }
    setShowRemoveFromFolderConfirm(false);
    setSpellToRemoveFromFolder(null);
  };

  const castSpell = (spellId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const spell = allSpells.find((s) => s.id === spellId);
    if (spell) {
      alert(`✨ ${spell.name} cast successfully!\n\nEffect: ${spell.description}`);
    }
  };

  const openAddToFolderDialog = (spellId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSpellToAddToFolder(spellId);
    setShowAddToFolderDialog(true);
  };

  const isSpellInAnyFolder = (spellId: string) => {
    return folders.some((folder) => folder.spellIds.includes(spellId));
  };

  const filteredSpells = allSpells.filter((spell) => {
    if (mode === 'grimoire') {
      if (!grimoire.has(spell.id)) return false;
    } else if (mode === 'folders') {
      if (!grimoire.has(spell.id)) return false;
      if (selectedFolder) {
        const folder = folders.find((f) => f.id === selectedFolder);
        if (!folder || !folder.spellIds.includes(spell.id)) return false;
      }
    } else if (mode === 'bookmarks') {
      if (!grimoire.has(spell.id) || !bookmarks.has(spell.id)) return false;
    }

    const matchesSearch =
      searchQuery === '' ||
      spell.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spell.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spell.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || spell.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    setDisplayedSpells(filteredSpells);
  }, [
    searchQuery,
    selectedCategory,
    allSpells,
    favoritesOnly,
    grimoire,
    bookmarks,
    selectedFolder,
    mode,
  ]);

  const getHeaderInfo = () => {
    switch (mode) {
      case 'grimoire':
        return {
          icon: <BookOpen className="h-6 w-6 text-primary" />,
          title: t.bazaar.allSpellsTitle,
          description: t.bazaar.allSpellsDescription,
        };
      case 'folders':
        return {
          icon: <Folder className="h-6 w-6 text-primary" />,
          title: t.bazaar.foldersTitle,
          description: t.bazaar.foldersDescription,
        };
      case 'bookmarks':
        return {
          icon: <Bookmark className="h-6 w-6 text-primary" />,
          title: t.bazaar.bookmarksTitle,
          description: t.bazaar.bookmarksDescription,
        };
      default:
        return {
          icon: <StoreIcon className="h-6 w-6 text-primary" />,
          title: t.bazaar.bazaarTitle,
          description: t.bazaar.bazaarDescription,
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="sticky top-12 z-40 border-b border-border/50 bg-background p-2 sm:p-3 overscroll-behavior-none">
        <div className="mx-auto max-w-6xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              {headerInfo.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-foreground">{headerInfo.title}</h1>
              <p className="text-sm text-muted-foreground break-words">{headerInfo.description}</p>
            </div>
          </div>

          {mode === 'folders' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{t.bazaar.folders}</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingFolder(null);
                    setNewFolderName('');
                    setShowFolderDialog(true);
                  }}
                  className="gap-2 shrink-0"
                >
                  <FolderPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.bazaar.newFolder}</span>
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {folders.map((folder) => (
                  <div key={folder.id} className="flex gap-1 items-center">
                    <Button
                      variant={selectedFolder === folder.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedFolder(folder.id)}
                      className={
                        selectedFolder === folder.id
                          ? ''
                          : 'border-white text-white hover:bg-white/10'
                      }
                    >
                      <Folder className="mr-2 h-4 w-4" />
                      {folder.name} ({folder.spellIds.length})
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-white hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFolder(folder);
                        setNewFolderName(folder.name);
                        setShowFolderDialog(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-white hover:bg-white/10"
                      onClick={(e) => confirmDeleteFolder(folder.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!(mode === 'folders' && !selectedFolder) && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t.bazaar.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className={
                    selectedCategory === null ? '' : 'border-white text-white hover:bg-white/10'
                  }
                >
                  {t.bazaar.all}
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className={
                      selectedCategory === category
                        ? ''
                        : 'border-white text-white hover:bg-white/10'
                    }
                  >
                    {getCategoryTranslation(category)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spell Grid */}
      <ScrollArea className="flex-1 bg-black scroll-smooth">
        <div className="flex min-h-full items-center">
          <div className="mx-auto w-full max-w-6xl px-4 pb-0 pt-4 sm:px-6 sm:pt-6">
            {mode === 'folders' && !selectedFolder ? (
              <div className="flex h-64 items-center justify-center">
                <div className="space-y-2 text-center px-4">
                  <Folder className="mx-auto h-16 w-16 text-muted-foreground" />
                  <p className="text-lg font-medium text-muted-foreground">
                    {t.bazaar.selectFolder}
                  </p>
                  <p className="text-sm text-muted-foreground">{t.bazaar.clickFolderToView}</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {displayedSpells.map((spell) => (
                  <div
                    key={spell.id}
                    onClick={() => setSelectedSpell(spell)}
                    className="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-black transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:scale-[1.02]"
                  >
                    {(mode !== 'bazaar' || grimoire.has(spell.id)) && (
                      <div className="absolute right-2 top-2 z-10 flex gap-1">
                        <button
                          onClick={(e) => toggleBookmark(spell.id, e)}
                          className="rounded-full bg-background/80 p-2 backdrop-blur-sm transition-all hover:bg-background"
                        >
                          <Bookmark
                            className={`h-4 w-4 transition-all ${
                              bookmarks.has(spell.id)
                                ? 'fill-primary text-primary'
                                : 'text-muted-foreground'
                            }`}
                          />
                        </button>
                      </div>
                    )}

                    <div className="space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                          {spell.image ? (
                            <img
                              src={spell.image || '/placeholder.svg'}
                              alt={spell.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Scroll className="h-6 w-6 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <h3 className="font-semibold text-foreground transition-colors group-hover:text-primary break-words">
                            {spell.name}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            by {spell.author}
                          </p>
                        </div>
                      </div>

                      <p className="line-clamp-2 text-sm text-muted-foreground break-words">
                        {spell.description}
                      </p>

                      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-0.5">
                          <div className="text-xs text-muted-foreground">
                            {spell.downloads.toLocaleString()} {t.bazaar.casts}
                          </div>
                          <div className="text-lg font-bold text-foreground">¥{spell.price}</div>
                        </div>
                        {mode === 'bookmarks' ? null : grimoire.has(spell.id) &&
                          mode === 'folders' &&
                          selectedFolder ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full gap-2 sm:w-auto"
                            onClick={(e) => confirmRemoveFromFolder(spell.id, e)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sm:inline">{t.bazaar.remove}</span>
                          </Button>
                        ) : grimoire.has(spell.id) &&
                          (mode === 'folders' || mode === 'grimoire') ? (
                          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full gap-2 border-white bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto"
                              onClick={(e) => openAddToFolderDialog(spell.id, e)}
                            >
                              {isSpellInAnyFolder(spell.id) ? (
                                <>
                                  <Edit2 className="h-4 w-4" />
                                  <span className="sm:inline">{t.bazaar.edit}</span>
                                </>
                              ) : (
                                <>
                                  <FolderPlus className="h-4 w-4" />
                                  <span className="sm:inline">{t.bazaar.folder}</span>
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="w-full gap-2 sm:w-auto"
                              onClick={(e) => confirmRemoveFromGrimoire(spell.id, e)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sm:inline">{t.bazaar.remove}</span>
                            </Button>
                          </div>
                        ) : grimoire.has(spell.id) ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full gap-2 sm:w-auto"
                            onClick={(e) => confirmRemoveFromGrimoire(spell.id, e)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sm:inline">{t.bazaar.remove}</span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="w-full gap-2 sm:w-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGrimoire(spell.id);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                            <span className="sm:inline">{t.bazaar.add}</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {displayedSpells.length === 0 && !(mode === 'folders' && !selectedFolder) && (
              <div className="flex h-64 items-center justify-center">
                <div className="space-y-2 text-center px-4">
                  <p className="text-lg font-medium text-muted-foreground">
                    {mode === 'grimoire'
                      ? t.bazaar.noSpellsInGrimoire
                      : mode === 'folders'
                        ? selectedFolder
                          ? t.bazaar.noSpellsInFolder
                          : t.bazaar.noSpellsInFolder
                        : mode === 'bookmarks'
                          ? t.bazaar.noBookmarkedSpells
                          : t.bazaar.noSpellsFound}
                  </p>
                  <p className="text-sm text-muted-foreground break-words">
                    {mode === 'grimoire' || mode === 'folders' || mode === 'bookmarks'
                      ? t.bazaar.addSpellsFromBazaar
                      : t.bazaar.tryDifferentSearch}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-black border border-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.bazaar.removeFromGrimoireTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-white">
              {t.bazaar.removeFromGrimoireDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={removeFromGrimoire}
              className="bg-black text-white border border-white hover:bg-white hover:text-black"
            >
              {t.bazaar.yes}
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => setShowDeleteConfirm(false)}
              className="bg-black text-white border border-white hover:bg-white hover:text-black"
            >
              {t.bazaar.no}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteFolderConfirm} onOpenChange={setShowDeleteFolderConfirm}>
        <AlertDialogContent className="bg-black border border-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.bazaar.deleteFolderTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-white">
              {t.bazaar.deleteFolderDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={deleteFolderConfirmed}
              className="bg-black text-white border border-white hover:bg-white hover:text-black"
            >
              {t.bazaar.yes}
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => setShowDeleteFolderConfirm(false)}
              className="bg-black text-white border border-white hover:bg-white hover:text-black"
            >
              {t.bazaar.no}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRemoveFromFolderConfirm} onOpenChange={setShowRemoveFromFolderConfirm}>
        <AlertDialogContent className="bg-black border border-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.bazaar.removeFromFolderTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-white">
              {t.bazaar.removeFromFolderDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={removeFromFolderConfirmed}
              className="bg-black text-white border border-white hover:bg-white hover:text-black"
            >
              {t.bazaar.yes}
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => setShowRemoveFromFolderConfirm(false)}
              className="bg-black text-white border border-white hover:bg-white hover:text-black"
            >
              {t.bazaar.no}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFolder ? t.bazaar.editFolderTitle : t.bazaar.createFolderTitle}
            </DialogTitle>
            <DialogDescription>
              {editingFolder ? t.bazaar.editFolderDescription : t.bazaar.createFolderDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">{t.bazaar.folderNameLabel}</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t.bazaar.folderNamePlaceholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createFolder();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
              {t.bazaar.cancel}
            </Button>
            <Button onClick={createFolder} disabled={!newFolderName.trim()}>
              {editingFolder ? t.bazaar.update : t.bazaar.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddToFolderDialog} onOpenChange={setShowAddToFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.bazaar.addToFolderTitle}</DialogTitle>
            <DialogDescription>{t.bazaar.addToFolderDescription}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[300px] py-4">
            <div className="space-y-2">
              {folders.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8">
                  <p className="text-center text-sm text-muted-foreground">
                    {t.bazaar.noFoldersYet}
                  </p>
                </div>
              ) : (
                folders.map((folder) => {
                  const isInFolder =
                    spellToAddToFolder && folder.spellIds.includes(spellToAddToFolder);
                  return (
                    <Button
                      key={folder.id}
                      variant={isInFolder ? 'secondary' : 'outline'}
                      className="w-full justify-start gap-2"
                      onClick={() => {
                        if (spellToAddToFolder) {
                          if (isInFolder) {
                            removeSpellFromFolder(spellToAddToFolder, folder.id);
                          } else {
                            addSpellToFolder(spellToAddToFolder, folder.id);
                          }
                        }
                      }}
                    >
                      <Folder className="h-4 w-4" />
                      {folder.name} ({folder.spellIds.length})
                      {isInFolder && <span className="ml-auto text-xs">✓</span>}
                    </Button>
                  );
                })
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddToFolderDialog(false);
                setEditingFolder(null);
                setNewFolderName('');
                setShowFolderDialog(true);
              }}
              className="gap-2"
            >
              <FolderPlus className="h-4 w-4" />
              {t.bazaar.newFolderButton}
            </Button>
            <Button
              onClick={() => {
                setShowAddToFolderDialog(false);
                setSpellToAddToFolder(null);
              }}
            >
              {t.bazaar.done}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedSpell}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSpell(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col p-0">
          {selectedSpell && (
            <>
              <div className="flex-1 overflow-y-auto">
                <DialogHeader
                  className={`border-b border-border p-6 ${!selectedSpell.image ? 'items-center text-center' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                      {selectedSpell.image ? (
                        <img
                          src={selectedSpell.image || '/placeholder.svg'}
                          alt={selectedSpell.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Scroll className="h-8 w-8 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <DialogTitle className="text-2xl">{selectedSpell.name}</DialogTitle>
                      <DialogDescription className="flex flex-col gap-2 text-base sm:flex-row sm:items-center sm:gap-4">
                        <span>by {selectedSpell.author}</span>
                        <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1 w-fit">
                          <Download className="h-4 w-4" />
                          {selectedSpell.downloads.toLocaleString()} {t.bazaar.casts}
                        </span>
                      </DialogDescription>
                    </div>
                    {(mode !== 'bazaar' || grimoire.has(selectedSpell.id)) && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleBookmark(selectedSpell.id)}
                          className="rounded-full p-2 transition-all hover:bg-accent"
                        >
                          <Bookmark
                            className={`h-6 w-6 transition-all ${
                              bookmarks.has(selectedSpell.id)
                                ? 'fill-primary text-primary'
                                : 'text-muted-foreground'
                            }`}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                </DialogHeader>

                <div className="space-y-6 p-6">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-primary">¥{selectedSpell.price}</div>
                    <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1">
                      <Tag className="h-4 w-4" />
                      <span className="text-sm">{selectedSpell.category}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground">{t.bazaar.artifactType}</h3>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3">
                      <Package className="h-5 w-5 text-primary" />
                      <span className="text-sm text-foreground">
                        {selectedSpell.artifactType ? (
                          <>
                            <span className="font-medium">{selectedSpell.artifactType}</span>
                            <span className="ml-2 text-muted-foreground">
                              ({t.bazaar.deployableArtifact})
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-medium">{t.bazaar.workflow}</span>
                            <span className="ml-2 text-muted-foreground">
                              ({t.bazaar.noArtifact})
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground">{t.bazaar.description}</h3>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {selectedSpell.longDescription}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground">{t.bazaar.features}</h3>
                    <ul className="space-y-2">
                      {selectedSpell.features.map((feature, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground">{t.bazaar.requirements}</h3>
                    <ul className="space-y-1">
                      {selectedSpell.requirements.map((req, index) => (
                        <li key={index} className="text-sm text-muted-foreground">
                          • {req}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-6">
                    <div>
                      <span className="font-medium">{t.bazaar.version}:</span>{' '}
                      {selectedSpell.version}
                    </div>
                    <div>
                      <span className="font-medium">{t.bazaar.updated}:</span>{' '}
                      {selectedSpell.lastUpdated}
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-border bg-background p-6">
                <div className="flex flex-col justify-center gap-2 sm:flex-row">
                  {mode === 'bookmarks' ? (
                    <Button
                      className="w-full gap-2 sm:w-auto"
                      size="lg"
                      onClick={() => castSpell(selectedSpell.id)}
                    >
                      <Wand2 className="h-5 w-5" />
                      {t.bazaar.cast}
                    </Button>
                  ) : grimoire.has(selectedSpell.id) ? (
                    <>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => openAddToFolderDialog(selectedSpell.id)}
                        className="w-full gap-2 border-white text-white hover:bg-white/10 hover:text-white sm:w-auto"
                      >
                        {isSpellInAnyFolder(selectedSpell.id) ? (
                          <>
                            <Edit2 className="h-5 w-5" />
                            {t.bazaar.editFolders}
                          </>
                        ) : (
                          <>
                            <FolderPlus className="h-5 w-5" />
                            {t.bazaar.addToFolder}
                          </>
                        )}
                      </Button>
                      {mode === 'folders' && selectedFolder ? (
                        <Button
                          size="lg"
                          variant="destructive"
                          onClick={() => confirmRemoveFromFolder(selectedSpell.id)}
                          className="w-full gap-2 sm:w-auto"
                        >
                          <Trash2 className="h-5 w-5" />
                          {t.bazaar.removeFromFolder}
                        </Button>
                      ) : (
                        <Button
                          size="lg"
                          variant="destructive"
                          onClick={() => confirmRemoveFromGrimoire(selectedSpell.id)}
                          className="w-full gap-2 sm:w-auto"
                        >
                          <Trash2 className="h-5 w-5" />
                          <span className="sm:inline">{t.bazaar.remove}</span>
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      className="w-full gap-2 sm:w-auto"
                      size="lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGrimoire(selectedSpell.id);
                      }}
                    >
                      <Plus className="h-5 w-5" />
                      <span className="hidden sm:inline">
                        {t.bazaar.add} (¥{selectedSpell.price})
                      </span>
                      <span className="sm:hidden">
                        {t.bazaar.add} (¥{selectedSpell.price})
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SAMPLE_SPELLS: SpellItem[] = [
  {
    id: '1',
    name: 'Time Acceleration Spell',
    author: 'Chronos Master',
    description:
      'A powerful spell that doubles your task processing speed. Perfect for tight project deadlines.',
    longDescription:
      "The Time Acceleration Spell is an innovative magic that dramatically improves your work efficiency. When you use this spell, you can process tasks at twice the normal speed. It's ideal when project deadlines are approaching or when you need to complete a large amount of work in a short time.\n\nThis spell works not by manipulating the flow of time, but by maximizing your concentration and processing abilities. As a side effect, you may feel slight fatigue after use, but proper rest will help you recover.",
    category: 'Productivity',
    price: 299,
    rating: 4.8,
    downloads: 1234,
    features: [
      'Double task processing speed',
      'Significant concentration boost',
      'Multi-tasking support',
      'Fatigue reduction feature',
      'Customizable acceleration levels',
    ],
    requirements: ['Level 5 or higher', 'Magic power 100+', 'Concentration skill'],
    version: '2.1.0',
    lastUpdated: '2024-01-15',
    image: '/time-acceleration-magic-clock.jpg',
    artifactType: null, // Workflow - no artifact
  },
  {
    id: '2',
    name: 'Creative Flames',
    author: 'Creative Wizard',
    description: 'Magic that materializes ideas. Revolutionizes brainstorming and design work.',
    longDescription:
      "Creative Flames is a powerful spell that unleashes your creativity. When you use this magic, ideas in your head are visualized and appear in concrete form. It will become an essential tool for designers, artists, and creators.\n\nIn brainstorming sessions, it visualizes all participants' ideas in real-time, enabling more effective collaboration. When used individually, it helps draw out ideas sleeping in your subconscious.",
    category: 'Creative',
    price: 499,
    rating: 4.9,
    downloads: 2341,
    features: [
      'Instant idea visualization',
      'Real-time collaboration',
      '3D modeling support',
      'Auto color palette generation',
      'Inspiration boost',
    ],
    requirements: ['Level 7 or higher', 'Creativity skill', 'Imagination 150+'],
    version: '3.0.2',
    lastUpdated: '2024-01-20',
    image: '/creative-flames-fire-art.jpg',
    artifactType: 'Tool', // Generates a Tool artifact
  },
  {
    id: '3',
    name: 'Focus Barrier',
    author: 'Focus Sage',
    description:
      'Completely shuts out external noise and distractions, creating a deep state of concentration.',
    longDescription:
      'The Focus Barrier creates an invisible barrier around you, completely blocking external interference. When you use this spell, you can enter a deep state of concentration even in the noisiest environment.\n\nInside the barrier, your sense of time changes, and hours feel like minutes. This effect makes you less likely to feel tired even during long work sessions. The barrier also protects you from not only physical sounds but also digital notifications and distracting thoughts.',
    category: 'Productivity',
    price: 199,
    rating: 4.7,
    downloads: 3456,
    features: [
      'Complete silent environment',
      'Digital notification blocking',
      'Time perception optimization',
      'Fatigue reduction effect',
      'Customizable barrier range',
    ],
    requirements: ['Level 3 or higher', 'Mental power 50+'],
    version: '1.5.1',
    lastUpdated: '2024-01-10',
    artifactType: null, // Workflow - no artifact
  },
  {
    id: '4',
    name: 'Data Analysis Eye',
    author: 'Analytics Sorcerer',
    description: 'Instantly visualizes complex data patterns and reveals hidden insights.',
    longDescription:
      'The Data Analysis Eye gives you the ability to instantly spot important patterns and trends in vast amounts of data. When you use this spell, numbers and graphs float up three-dimensionally, and relationships between data become understandable at a glance.\n\nIt becomes a powerful tool for business analysts, data scientists, and researchers. Complex statistical analysis becomes intuitively understandable, greatly improving the speed and accuracy of decision-making.',
    category: 'Analytics',
    price: 599,
    rating: 4.6,
    downloads: 987,
    features: [
      '3D data visualization',
      'Automatic pattern detection',
      'Predictive analytics',
      'Real-time dashboard',
      'Instant outlier identification',
    ],
    requirements: ['Level 8 or higher', 'Analysis skill', 'Logical thinking 100+'],
    version: '2.3.0',
    lastUpdated: '2024-01-18',
    image: '/data-analytics-eye-visualization.jpg',
    artifactType: 'App', // Generates an App artifact
  },
  {
    id: '5',
    name: 'Communication Bridge',
    author: 'Harmony Enchanter',
    description: 'A magical spell that smooths team communication and prevents misunderstandings.',
    longDescription:
      "The Communication Bridge gives you the power to convey true intentions beyond language barriers and cultural differences. When you use this spell, your words reach directly to the other person's heart, making misunderstandings and discrepancies less likely.\n\nIt is particularly effective in team meetings, presentations, and negotiations. It also enhances non-verbal communication, allowing you to understand the emotions and intentions of others more deeply.",
    category: 'Collaboration',
    price: 399,
    rating: 4.8,
    downloads: 1567,
    features: [
      'Communication beyond language barriers',
      'Emotion visualization',
      'Auto-detection and correction of misunderstandings',
      'Enhanced non-verbal communication',
      'Group harmony promotion',
    ],
    requirements: ['Level 5 or higher', 'Empathy skill', 'Sociability 70+'],
    version: '1.8.0',
    lastUpdated: '2024-01-12',
    artifactType: 'Tool', // Generates a Tool artifact
  },
  {
    id: '6',
    name: 'Automation Spirit',
    author: 'Automation Mage',
    description: 'Automates repetitive tasks and saves valuable time.',
    longDescription:
      'The Automation Spirit is an intelligent being that learns your daily tasks and executes them automatically. When you cast this spell, a small spirit observes your work patterns and identifies repetitive tasks.\n\nOnce it learns the patterns, the spirit autonomously executes tasks, allowing you to focus on more creative and valuable work. It handles various tasks such as email organization, data entry, and report creation.',
    category: 'Productivity',
    price: 699,
    rating: 4.9,
    downloads: 2890,
    features: [
      'Advanced feature 1',
      'Innovative feature 2',
      'Convenient feature 3',
      'Powerful feature 4',
      'Customizable',
    ],
    requirements: [`Level ${Math.floor(Math.random() * 10) + 1} or higher`, 'Basic skills'],
    version: '1.0.0',
    lastUpdated: '2024-01-01',
    image: '/automation-spirit-robot-assistant.jpg',
    artifactType: 'App', // Generates an App artifact
  },
];

const generateMoreSpells = (startId: number, count: number): SpellItem[] => {
  const categories = ['Productivity', 'Creative', 'Analytics', 'Collaboration'];
  const artifactTypes: SpellItem['artifactType'][] = ['App', 'Tool', 'Template', null]; // Added artifact types
  const spells: SpellItem[] = [];

  for (let i = 0; i < count; i++) {
    const id = startId + i;
    spells.push({
      id: id.toString(),
      name: `Magic Spell ${id}`,
      author: `Wizard ${id}`,
      description: `This is the description for spell number ${id}. A powerful magic with various effects.`,
      longDescription: `This is a detailed description for spell number ${id}. This spell has a long history and has been loved by many wizards. Its effects are proven and will revolutionize your daily life.\n\nThe development of this spell took several years and is designed based on the latest magical theory.`,
      category: categories[i % categories.length],
      price: Math.floor(Math.random() * 500) + 100,
      rating: 4.5 + Math.random() * 0.5,
      downloads: Math.floor(Math.random() * 5000),
      features: [
        'Advanced feature 1',
        'Innovative feature 2',
        'Convenient feature 3',
        'Powerful feature 4',
        'Customizable',
      ],
      requirements: [`Level ${Math.floor(Math.random() * 10) + 1} or higher`, 'Basic skills'],
      version: '1.0.0',
      lastUpdated: '2024-01-01',
      artifactType: artifactTypes[i % artifactTypes.length], // Randomly assign artifact type
    });
  }

  return spells;
};
