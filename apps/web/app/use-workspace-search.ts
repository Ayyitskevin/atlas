"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { api, errorMessage } from "./atlas-api";
import type { AuthPair, Page, SearchResult } from "./atlas-types";

type UseWorkspaceSearchInput = {
  auth: AuthPair | null;
  chooseProject: (accessToken: string, workspaceId: string, projectId: string) => Promise<void>;
  chooseTask: (taskId: string) => Promise<void>;
  selectedWorkspaceId: string;
  setMessage: (message: string) => void;
};

export function useWorkspaceSearch({ auth, chooseProject, chooseTask, selectedWorkspaceId, setMessage }: UseWorkspaceSearchInput) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState("");

  function clearSearch() {
    setSearchQuery("");
    setSearchResults([]);
    setSearchStatus("");
  }

  async function searchWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId) return;
    const queryText = searchQuery.trim();
    if (!queryText) {
      setSearchResults([]);
      setSearchStatus("");
      return;
    }

    try {
      setSearchStatus("Searching...");
      const query = new URLSearchParams({ limit: "8", q: queryText });
      const resultPage = await api<Page<SearchResult>>(
        "/workspaces/" + selectedWorkspaceId + "/search?" + query.toString(),
        {},
        auth.accessToken,
      );
      setSearchResults(resultPage.items);
      setSearchStatus(resultPage.items.length + " " + (resultPage.items.length === 1 ? "result" : "results"));
      setMessage("");
    } catch (error) {
      setSearchStatus("");
      setMessage(errorMessage(error));
    }
  }

  async function openSearchResult(result: SearchResult) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setSearchStatus("Opening result...");
      if (result.type === "project") {
        await chooseProject(auth.accessToken, selectedWorkspaceId, result.project.id);
        setSearchStatus("");
        return;
      }

      await chooseProject(auth.accessToken, selectedWorkspaceId, result.task.projectId);
      await chooseTask(result.task.id);
      setSearchStatus("");
    } catch (error) {
      setSearchStatus("");
      setMessage(errorMessage(error));
    }
  }

  return {
    clearSearch,
    openSearchResult,
    searchQuery,
    searchResults,
    searchStatus,
    searchWorkspace,
    setSearchQuery,
  };
}
