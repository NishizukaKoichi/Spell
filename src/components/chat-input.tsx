'use client';
import type { ChatInputProps } from './chat-input-props'; // Declare the ChatInputProps variable
import type React from 'react';

import { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { SquareIcon, CircleIcon, ChevronRight, Folder, Bookmark } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';

interface BookmarkItem {
  id: string;
  name: string;
  author: string;
  description?: string;
  category?: string;
  tags?: string[];
  createdAt?: string;
  cost?: number; // Cost in currency units
}

interface FolderItem {
  id: string;
  name: string;
  bookmarks: BookmarkItem[];
}

export function ChatInput({ onSendMessage, onSpellSelect }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSpells, setFilteredSpells] = useState<BookmarkItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null);
  const grimoire = useMemo<FolderItem[]>(() => [], []); // Assuming grimoire is defined elsewhere

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    if (value.trim()) {
      const allSpells = grimoire.flatMap((folder) =>
        folder.bookmarks.map((bookmark) => ({
          ...bookmark,
          folderName: folder.name,
        }))
      );
      const filtered = allSpells.filter((spell) =>
        spell.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSpells(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setFilteredSpells([]);
      setShowSuggestions(false);
      setSelectedIndex(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredSpells.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredSpells.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredSpells.length) % filteredSpells.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSuggestionClick(filteredSpells[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
      }
    } else {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (input.trim()) {
          handleSubmit(e);
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
      setShowSuggestions(false);
      setSelectedIndex(0);
    }
  };

  const handleSuggestionClick = (spell: BookmarkItem) => {
    setInput(spell.name);
    onSpellSelect?.(spell);
    setShowSuggestions(false);
    setSelectedIndex(0);
  };

  const handleFolderClick = (folder: FolderItem) => {
    setSelectedFolder(folder);
  };

  const handleBack = () => {
    setSelectedFolder(null);
  };

  const handleBookmarkClick = (bookmark: BookmarkItem) => {
    setInput(bookmark.name);
    onSpellSelect?.(bookmark);
    setIsOpen(false);
  };

  const getContentHeight = () => {
    if (!selectedFolder) {
      const folderCount = grimoire.length || 1;
      return Math.min(Math.max(folderCount * 44 + 32, 150), 400);
    } else {
      const bookmarkCount = selectedFolder.bookmarks.length || 1;
      return Math.min(Math.max(bookmarkCount * 44 + 80, 150), 400);
    }
  };

  return (
    <div className="border-t border-border/50 bg-background p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 sm:gap-3">
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 sm:h-12 sm:w-12"
                onClick={() => {
                  setIsOpen(!isOpen);
                  setSelectedFolder(null);
                }}
              >
                <SquareIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <ScrollArea
                style={{ height: `${getContentHeight()}px` }}
                className="bg-black border-2 border-white rounded-lg"
              >
                <div className="p-2">
                  {!selectedFolder ? (
                    <div className="space-y-1">
                      {grimoire.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-white">
                          No spells yet
                        </div>
                      ) : (
                        grimoire.map((folder) => (
                          <button
                            key={folder.id}
                            onClick={() => handleFolderClick(folder)}
                            className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm text-white hover:bg-white/10"
                          >
                            <div className="flex items-center gap-2">
                              <Folder className="h-4 w-4 text-white/70" />
                              <span>{folder.name}</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-white/70" />
                          </button>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <button
                        onClick={handleBack}
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-sm font-semibold text-white hover:bg-white/10 rounded-md"
                      >
                        <ChevronRight className="h-4 w-4 rotate-180" />
                        <span>{selectedFolder.name}</span>
                      </button>
                      <div className="border-t border-white/20 my-1" />
                      {selectedFolder.bookmarks.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-white">
                          No spells yet
                        </div>
                      ) : (
                        selectedFolder.bookmarks.map((bookmark) => (
                          <button
                            key={bookmark.id}
                            onClick={() => handleBookmarkClick(bookmark)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-white hover:bg-white/10"
                          >
                            <Bookmark className="h-4 w-4 text-white/70" />
                            <span>{bookmark.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <div className="relative flex flex-1 items-center rounded-[22px] bg-muted px-3 shadow-sm sm:rounded-[26px] sm:px-4">
            <Textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder=""
              className="min-h-[44px] max-h-[200px] w-full resize-none border-0 bg-transparent py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 sm:min-h-[52px] sm:py-4 sm:text-base"
              rows={1}
            />

            {showSuggestions && filteredSpells.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border-2 border-white bg-black shadow-lg z-50">
                <ScrollArea className="max-h-[300px] bg-black text-white">
                  <div className="p-2 space-y-1">
                    {filteredSpells.map((spell, index) => (
                      <button
                        key={spell.id}
                        type="button"
                        onClick={() => handleSuggestionClick(spell)}
                        className={`flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm text-white hover:bg-white/10 ${
                          index === selectedIndex ? 'bg-white/20' : ''
                        }`}
                      >
                        <Bookmark className="h-4 w-4 mt-0.5 shrink-0 text-white/70" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white">{spell.name}</div>
                          {spell.description && (
                            <div className="text-xs text-white/70 truncate">
                              {spell.description}
                            </div>
                          )}
                          <div className="text-xs text-white/70">by {spell.author}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 sm:h-12 sm:w-12"
          >
            <CircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
