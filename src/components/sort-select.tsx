"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SortSelectProps {
  value: string;
  onChange: (value: string) => void;
}

const sortOptions = [
  { value: "createdAt", label: "Newest First", order: "desc" },
  { value: "rating", label: "Highest Rated", order: "desc" },
  { value: "casts", label: "Most Popular", order: "desc" },
  { value: "name", label: "Name (A-Z)", order: "asc" },
];

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px] bg-white text-black/5 border-white/10">
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        {sortOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
