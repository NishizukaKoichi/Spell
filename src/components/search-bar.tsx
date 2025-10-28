"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
      <Input
        type="text"
        placeholder={placeholder || "Search spells..."}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 bg-white/5 border-white/10 focus:border-purple-500"
      />
    </div>
  );
}
