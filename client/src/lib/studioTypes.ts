import type { ContentSnapshot } from "@shared/catalog";
import { useStudyState } from "@/lib/useStudyState";

export type ReturnTypeUseStudy = ReturnType<typeof useStudyState>;

export type StudioViewProps = {
  snapshot: ContentSnapshot;
  study: ReturnTypeUseStudy;
  contentLoading: boolean;
  contentError: boolean;
};
