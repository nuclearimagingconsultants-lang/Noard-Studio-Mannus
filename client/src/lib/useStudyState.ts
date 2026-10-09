import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  courseStatus,
  getGuestNotes,
  getGuestProgress,
  saveGuestNote,
  saveGuestProgress,
  type StoredNote,
  type StoredProgress,
  type StudyStatus,
} from "@/lib/studyStorage";

// Keep guest study useful offline; account procedures replace the local source after sign-in.
export function useStudyState() {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const [guestProgress, setGuestProgress] = useState<StoredProgress[]>(() =>
    getGuestProgress()
  );
  const [guestNotes, setGuestNotes] = useState<StoredNote[]>(() =>
    getGuestNotes()
  );
  const scope = auth.user?.id ?? 0;
  const scopeInput = { scope };
  const queryEnabled = auth.isAuthenticated && scope > 0;
  const progressQuery = trpc.study.progress.list.useQuery(scopeInput, {
    enabled: queryEnabled,
    retry: false,
  });
  const notesQuery = trpc.study.notes.list.useQuery(scopeInput, {
    enabled: queryEnabled,
    retry: false,
  });
  const updateProgress = trpc.study.progress.upsert.useMutation({
    onMutate: async input => {
      await utils.study.progress.list.cancel(scopeInput);
      const previous = utils.study.progress.list.getData(scopeInput);
      const optimistic = {
        ...input,
        id: -1,
        userId: scope,
        updatedAt: new Date(),
      };
      utils.study.progress.list.setData(scopeInput, current => [
        optimistic,
        ...(current ?? []).filter(
          item =>
            item.courseId !== input.courseId || item.lessonId !== input.lessonId
        ),
      ]);
      return { previous };
    },
    onError: (_error, _input, context) => {
      utils.study.progress.list.setData(scopeInput, context?.previous);
      toast.error(
        "Progress could not be saved. Your next update will retry it."
      );
    },
    onSuccess: saved => {
      utils.study.progress.list.setData(scopeInput, current => [
        saved,
        ...(current ?? []).filter(
          item =>
            item.courseId !== saved.courseId || item.lessonId !== saved.lessonId
        ),
      ]);
    },
    onSettled: () => void utils.study.progress.list.invalidate(scopeInput),
  });
  const updateNote = trpc.study.notes.upsert.useMutation({
    onMutate: async input => {
      await utils.study.notes.list.cancel(scopeInput);
      const previous = utils.study.notes.list.getData(scopeInput);
      const optimistic = {
        ...input,
        id: -1,
        userId: scope,
        updatedAt: new Date(),
      };
      utils.study.notes.list.setData(scopeInput, current => [
        optimistic,
        ...(current ?? []).filter(item => item.courseId !== input.courseId),
      ]);
      return { previous };
    },
    onError: (_error, _input, context) => {
      utils.study.notes.list.setData(scopeInput, context?.previous);
      toast.error(
        "Private note could not be saved. Keep editing and try Save private note again."
      );
    },
    onSuccess: saved => {
      utils.study.notes.list.setData(scopeInput, current => [
        saved,
        ...(current ?? []).filter(item => item.courseId !== saved.courseId),
      ]);
    },
    onSettled: () => void utils.study.notes.list.invalidate(scopeInput),
  });

  const progress = useMemo<StoredProgress[]>(() => {
    if (!auth.isAuthenticated) return guestProgress;
    return (progressQuery.data ?? []).map(item => ({
      courseId: item.courseId,
      lessonId: item.lessonId,
      status: item.status as StudyStatus,
      positionSeconds: item.positionSeconds,
      updatedAt: item.updatedAt.toISOString(),
    }));
  }, [auth.isAuthenticated, guestProgress, progressQuery.data]);

  const notes = useMemo<StoredNote[]>(() => {
    if (!auth.isAuthenticated) return guestNotes;
    return (notesQuery.data ?? []).map(item => ({
      courseId: item.courseId,
      content: item.content,
      updatedAt: item.updatedAt.toISOString(),
    }));
  }, [auth.isAuthenticated, guestNotes, notesQuery.data]);

  const saveProgress = useCallback(
    (next: Omit<StoredProgress, "updatedAt">) => {
      const entry: StoredProgress = {
        ...next,
        updatedAt: new Date().toISOString(),
      };
      if (!auth.isAuthenticated) {
        saveGuestProgress(entry);
        setGuestProgress(getGuestProgress());
        return;
      }
      void updateProgress
        .mutateAsync({
          courseId: entry.courseId,
          lessonId: entry.lessonId,
          status: entry.status,
          positionSeconds: Math.max(0, Math.floor(entry.positionSeconds)),
        })
        .catch(() => undefined);
    },
    [auth.isAuthenticated, updateProgress]
  );

  const saveNote = useCallback(
    async (courseId: string, content: string) => {
      const entry: StoredNote = {
        courseId,
        content,
        updatedAt: new Date().toISOString(),
      };
      if (!auth.isAuthenticated) {
        saveGuestNote(entry);
        setGuestNotes(getGuestNotes());
        return true;
      }
      try {
        await updateNote.mutateAsync({ courseId, content });
        return true;
      } catch {
        return false;
      }
    },
    [auth.isAuthenticated, updateNote]
  );

  // Guest entries are intentionally not silently copied into an account; the label explains the boundary.
  useEffect(() => {
    if (!auth.isAuthenticated) {
      setGuestProgress(getGuestProgress());
      setGuestNotes(getGuestNotes());
    }
  }, [auth.isAuthenticated]);

  return {
    auth,
    progress,
    notes,
    getCourseStatus: (courseId: string) => courseStatus(progress, courseId),
    getNote: (courseId: string) =>
      notes.find(note => note.courseId === courseId)?.content ?? "",
    saveProgress,
    saveNote,
    progressReady:
      !auth.loading &&
      (!auth.isAuthenticated ||
        progressQuery.isSuccess ||
        progressQuery.isError),
    progressLoading:
      auth.loading || (auth.isAuthenticated && progressQuery.isLoading),
    isSaving: updateProgress.isPending || updateNote.isPending,
  };
}
