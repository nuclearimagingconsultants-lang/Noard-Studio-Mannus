import {
  emptyCatalog,
  emptyOriginalLectures,
  type MedicalSchool,
  type ContentSnapshot,
} from "@shared/catalog";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";

const CONTENT_REFRESH_MS = 45_000;
const MEDICAL_CATALOG_REFRESH_MS = 3 * 60_000;
const ACTIVE_MEDICAL_INGESTION =
  /(^|[\s_-])(research|building|in[\s_-]?progress)(?=$|[\s_-])/i;

function medicalCatalogueIsIngesting(school?: MedicalSchool): boolean {
  return [school?.status, school?.state].some(
    value => typeof value === "string" && ACTIVE_MEDICAL_INGESTION.test(value)
  );
}

const unavailableSnapshot: ContentSnapshot = {
  catalog: emptyCatalog(),
  media: emptyOriginalLectures(),
  assetIndex: null,
  updatedAt: "",
};

/** A direct course visit must not download every specialty's full curriculum. */
export function useStudioData() {
  const [location] = useLocation();
  const search = useSearch();
  const courseMatch = location.match(/^\/course\/([^/]+)\/?$/);
  let courseId = "__not_a_course_route__";
  if (courseMatch) {
    try {
      courseId = decodeURIComponent(courseMatch[1]);
    } catch {
      courseId = "__invalid_course_route__";
    }
  }
  const isCourseRoute = Boolean(courseMatch);
  const scope =
    new URLSearchParams(search).get("scope") === "program"
      ? ("program" as const)
      : ("course" as const);
  const workspaceQuery = trpc.content.workspace.useQuery(
    { courseId, scope },
    {
      enabled: isCourseRoute,
      staleTime: CONTENT_REFRESH_MS,
      refetchInterval: isCourseRoute ? CONTENT_REFRESH_MS : false,
      refetchOnWindowFocus: true,
      retry: 1,
    }
  );
  const catalogQuery = trpc.content.catalog.useQuery(undefined, {
    enabled: !isCourseRoute,
    staleTime: CONTENT_REFRESH_MS,
    refetchInterval: query =>
      !isCourseRoute &&
      medicalCatalogueIsIngesting(query.state.data?.medicalSchool)
        ? CONTENT_REFRESH_MS
        : MEDICAL_CATALOG_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const mediaQuery = trpc.content.media.useQuery(undefined, {
    enabled: !isCourseRoute,
    staleTime: CONTENT_REFRESH_MS,
    refetchInterval: isCourseRoute ? false : CONTENT_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const snapshot: ContentSnapshot = isCourseRoute
    ? (workspaceQuery.data ?? unavailableSnapshot)
    : {
        catalog: catalogQuery.data ?? unavailableSnapshot.catalog,
        media: mediaQuery.data ?? unavailableSnapshot.media,
        assetIndex: null,
        updatedAt: new Date(
          Math.max(catalogQuery.dataUpdatedAt, mediaQuery.dataUpdatedAt)
        ).toISOString(),
      };
  return {
    isLoading: isCourseRoute
      ? workspaceQuery.isLoading
      : catalogQuery.isLoading || mediaQuery.isLoading,
    error: isCourseRoute
      ? workspaceQuery.error
      : (catalogQuery.error ?? mediaQuery.error),
    snapshot,
    hasContent:
      snapshot.catalog.programs.length > 0 ||
      snapshot.catalog.courses.length > 0,
  };
}
