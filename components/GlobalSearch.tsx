"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { useCounters } from "@/app/context/CountersContext";
import { useFilter, FilterState } from "@/app/context/FilterContext";
import { sliceSlug, months } from "@/app/helpers";

export function GlobalSearch() {
  const router = useRouter();
  const { values } = useCounters();
  const { filters, setFilters } = useFilter();
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const options = React.useMemo(() => {
    const allOptions: {
      type: string;
      value: string;
      label: React.ReactNode;
      textValue?: string;
    }[] = [];

    // Tags
    Object.keys(values.values.tags || {}).forEach((tag) => {
      allOptions.push({ type: "tag", value: `tag:${tag}`, label: tag });
    });

    // Authors (nick)
    Object.keys(values.values.nick || {}).forEach((nick) => {
      allOptions.push({ type: "author", value: `author:${nick}`, label: nick });
    });

    // Models
    Object.keys(values.values.model || {}).forEach((model) => {
      allOptions.push({ type: "model", value: `model:${model}`, label: model });
    });

    // Lenses
    Object.keys(values.values.lens || {}).forEach((lens) => {
      allOptions.push({ type: "lens", value: `lens:${lens}`, label: lens });
    });

    // Years
    Object.keys(values.values.year || {})
      .sort((a, b) => b.localeCompare(a))
      .forEach((year) => {
        allOptions.push({ type: "year", value: `year:${year}`, label: year });
      });

    // Months
    Object.entries(months)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .forEach(([, monthName]) => {
        allOptions.push({
          type: "month",
          value: `month:${monthName}`,
          label: monthName,
          textValue: monthName,
        });
      });

    // Days (1-31)
    for (let day = 1; day <= 31; day++) {
      allOptions.push({
        type: "day",
        value: `day:${day}`,
        label: day.toString(),
        textValue: day.toString(),
      });
    }

    return allOptions;
  }, [values.values]);

  const selectedValues = React.useMemo(() => {
    const vals: string[] = [];
    if (filters.year) vals.push(`year:${filters.year}`);
    if (filters.month) vals.push(`month:${filters.month}`);
    if (filters.day) vals.push(`day:${filters.day}`);
    filters.tags.forEach((t) => vals.push(`tag:${t}`));
    if (filters.nick) vals.push(`author:${filters.nick}`);
    if (filters.model) vals.push(`model:${filters.model}`);
    if (filters.lens) vals.push(`lens:${filters.lens}`);
    if (filters.searchText) vals.push(`text:${filters.searchText}`);
    return vals;
  }, [filters]);

  const handleTextSearch = React.useCallback(
    (text: string) => {
      if (!text) return;

      const trimmed = text.trim();
      const num = parseInt(trimmed);

      const nextFilters: FilterState = {
        ...filters,
      };

      // Detect Year (4 digits)
      if (!isNaN(num) && /^\d{4}$/.test(trimmed)) {
        nextFilters.year = trimmed;
        nextFilters.text = [];
        nextFilters.searchText = "";
      }
      // Detect Month name (part of name)
      else {
        const monthId = Object.keys(months).find((key) =>
          (months as Record<string, string>)[key]
            .toLowerCase()
            .includes(trimmed.toLowerCase()),
        );
        if (monthId) {
          nextFilters.month = monthId;
          nextFilters.text = [];
          nextFilters.searchText = "";
        }
        // Default: Headline Search
        else {
          nextFilters.text = sliceSlug(text);
          nextFilters.searchText = text;
        }
      }

      setFilters(nextFilters);
      setOpen(false);
      router.push("/list");
    },
    [router, setFilters, filters],
  );

  const handleValueChange = (newValues: string[]) => {
    const nextFilters: FilterState = {
      ...filters,
      year: null,
      month: null,
      day: null,
      tags: [],
      model: null,
      lens: null,
      nick: null,
      text: [],
      searchText: "",
    };

    newValues.forEach((val) => {
      const [type, actualValue] = val.split(":");
      if (type === "year") {
        nextFilters.year = actualValue;
      } else if (type === "month") {
        nextFilters.month = actualValue;
      } else if (type === "day") {
        nextFilters.day = parseInt(actualValue);
      } else if (type === "tag") {
        nextFilters.tags.push(actualValue);
      } else if (type === "author") {
        nextFilters.nick = actualValue;
      } else if (type === "model") {
        nextFilters.model = actualValue;
      } else if (type === "lens") {
        nextFilters.lens = actualValue;
      } else if (type === "text") {
        nextFilters.text = sliceSlug(actualValue);
        nextFilters.searchText = actualValue;
      }
    });

    setFilters(nextFilters);
    if (newValues.length > selectedValues.length) {
      setOpen(false);
      router.push("/list");
    }
  };

  return (
    <div className="relative w-full max-w-sm">
      <Combobox
        value={selectedValues}
        onValueChange={handleValueChange}
        onOpenChange={setOpen}
        open={open}
        onInputValueChange={setInputValue}
        multiple
      >
        <ComboboxChips className="rounded-full bg-muted/50 border-none pl-3 pr-2 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Search className="h-4 w-4 text-muted-foreground mr-1 shrink-0" />
          {selectedValues.map((val) => {
            const [type, label] = val.split(":");
            return (
              <ComboboxChip key={val} className="h-6 gap-1 px-2">
                {type === "month"
                  ? (months as Record<string | number, string>)[
                      parseInt(label)
                    ] ||
                    (months as Record<string | number, string>)[label] ||
                    label
                  : label}
              </ComboboxChip>
            );
          })}
          <ComboboxChipsInput
            placeholder={
              selectedValues.length === 0
                ? "Search tags, authors, gear..."
                : undefined
            }
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && inputValue) {
                handleTextSearch(inputValue);
              }
            }}
          />
        </ComboboxChips>
        <ComboboxContent align="start" className="w-[300px]">
          <ComboboxList>
            <ComboboxEmpty>No results found.</ComboboxEmpty>
            {options.map((opt) => (
              <ComboboxItem
                key={opt.value}
                value={opt.value}
                textValue={opt.textValue as string}
              >
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 mr-2 min-w-12 inline-block">
                  {opt.type}
                </span>
                {opt.label}
              </ComboboxItem>
            ))}
            {inputValue && (
              <ComboboxItem
                value={`text:${inputValue}`}
                onClick={() => handleTextSearch(inputValue)}
              >
                <Search className="size-4 mr-2 opacity-50" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 mr-2 min-w-12 inline-block">
                  part of headline
                </span>
                {inputValue}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
