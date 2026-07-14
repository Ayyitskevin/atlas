"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { api, errorMessage } from "../shared/atlas-api";
import type { AuthPair, Page, SearchResult } from "../shared/atlas-types";
import { searchStatusMessage } from "./workspace-search-utils";

type UseWorkspaceSearchInput = {
  auth: AuthPair | null;
  chooseProject: (accessToken: string, workspaceId: string, projectId: string) => Promise<void>;
  chooseTask: (taskId: string) => Promise<void>;
  selectedWorkspaceId: string;
  setMessage: (message: string) => void;
};

export function useWorkspaceSearch({ auth, chooseProject, chooseTask, selectedWorkspaceId, setMessage }: UseWorkspaceSearchInput) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchNextCursor, setSearchNextCursor] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState("");

  function clearSearch() {
    setSearchQuery("");
    setSearchNextCursor("");
    setSearchResults([]);
    setSearchStatus("");
  }

  async function searchWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId) return;
    const queryText = searchQuery.trim();
    if (!queryText) {
      setSearchNextCursor("");
      setSearchResults([]);
      setSearchStatus("");
      return;
    }

    try {
      setSearchStatus("Searching...");
      const resultPage = await fetchSearchPage(auth.accessToken, queryText);
      setSearchResults(resultPage.items);
      setSearchNextCursor(resultPage.pageInfo?.nextCursor ?? "");
      setSearchStatus(searchStatusMessage(resultPage.items.length, Boolean(resultPage.pageInfo?.hasNextPage)));
      setMessage("");
    } catch (error) {
      setSearchStatus("");
      setMessage(errorMessage(error));
    }
  }

  async function loadMoreSearchResults() {
    if (!auth || !selectedWorkspaceId || !searchNextCursor) return;
    const queryText = searchQuery.trim();
    if (!queryText) return;

    try {
      setSearchStatus("Loading more results...");
      const resultPage = await fetchSearchPage(auth.accessToken, queryText, searchNextCursor);
      const nextResults = [...searchResults, ...resultPage.items];
      setSearchResults(nextResults);
      setSearchNextCursor(resultPage.pageInfo?.nextCursor ?? "");
      setSearchStatus(searchStatusMessage(nextResults.length, Boolean(resultPage.pageInfo?.hasNextPage)));
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

  async function fetchSearchPage(accessToken: string, queryText: string, cursor?: string) {
    const query = new URLSearchParams({ limit: "8", q: queryText });
    if (cursor) query.set("cursor", cursor);
    return api<Page<SearchResult>>(
      "/workspaces/" + selectedWorkspaceId + "/search?" + query.toString(),
      {},
      accessToken,
    );
  }

  return {
    clearSearch,
    hasMoreSearchResults: Boolean(searchNextCursor),
    loadMoreSearchResults,
    openSearchResult,
    searchQuery,
    searchResults,
    searchStatus,
    searchWorkspace,
    setSearchQuery,
  };
}
