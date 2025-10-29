"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategoryFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const categories = [
  { value: "all", label: "All Categories" },
  { value: "ai-ml", label: "AI & Machine Learning" },
  { value: "data", label: "Data Processing" },
  { value: "web", label: "Web Automation" },
  { value: "productivity", label: "Productivity" },
  { value: "communication", label: "Communication" },
  { value: "analytics", label: "Analytics" },
  { value: "other", label: "Other" },
];

export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] bg-white text-black/5 border-white/10">
        <SelectValue placeholder="Category" />
      </SelectTrigger>
      <SelectContent>
        {categories.map((category) => (
          <SelectItem key={category.value} value={category.value}>
            {category.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
