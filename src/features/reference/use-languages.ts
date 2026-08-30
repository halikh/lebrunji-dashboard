"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchLanguages } from "./api/languages";

export const languageKeys = { all: ["languages"] as const };

/**
 * The languages every content form renders an input for.
 *
 * Reference data that changes when somebody adds a language, which is to say
 * almost never — but when it does, every form grows a field without being
 * touched. That is the whole point of reading it rather than hardcoding it.
 */
export function useLanguages() {
  return useQuery({
    queryKey: languageKeys.all,
    queryFn: fetchLanguages,
    staleTime: 30 * 60_000,
  });
}
