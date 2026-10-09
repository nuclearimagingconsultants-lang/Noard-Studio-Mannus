import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StudioShell } from "@/components/studio/StudioShell";
import NotFound from "@/pages/NotFound";
import BoardPage from "@/pages/BoardPage";
import CourseWorkspace from "@/pages/CourseWorkspace";
import CoveragePage from "@/pages/CoveragePage";
import LibraryPage from "@/pages/LibraryPage";
import MedicalCataloguePage from "@/pages/MedicalCataloguePage";
import ProgramPage from "@/pages/ProgramPage";
import StudioDashboard from "@/pages/StudioDashboard";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useStudioData } from "./lib/useStudioData";
import { useStudyState } from "./lib/useStudyState";
import { contentPhase } from "./lib/contentPhase";
import { EmptyState } from "./components/studio/StudioPrimitives";
import "./course-workspace-fixes.css";

function StudioRoutes() {
  const content = useStudioData();
  const study = useStudyState();
  const props = {
    snapshot: content.snapshot,
    study,
    contentLoading: content.isLoading,
    contentError: Boolean(content.error),
  };
  const phase = contentPhase(
    content.hasContent,
    content.isLoading,
    Boolean(content.error)
  );
  return (
    <StudioShell programs={content.snapshot.catalog.programs} study={study}>
      {phase === "loading" ? (
        <div role="status" aria-live="polite">
          <EmptyState title="Loading your study workspace">
            Retrieving the course, available lectures and source PDFs. A loading
            course is not a missing course.
          </EmptyState>
        </div>
      ) : phase === "error" ? (
        <div role="alert">
          <EmptyState title="Study content could not load">
            The request failed; your course has not been deleted.{" "}
            <button
              className="button button-quiet"
              onClick={() => window.location.reload()}
            >
              Retry loading
            </button>
          </EmptyState>
        </div>
      ) : (
        <Switch>
          <Route path="/" component={() => <StudioDashboard {...props} />} />
          <Route
            path="/med"
            component={() => <MedicalCataloguePage {...props} />}
          />
          <Route path="/program/:programId">
            {params => <ProgramPage {...props} programId={params.programId} />}
          </Route>
          <Route path="/course/:courseId">
            {params => (
              <CourseWorkspace {...props} courseId={params.courseId} />
            )}
          </Route>
          <Route path="/board" component={() => <BoardPage {...props} />} />
          <Route path="/library" component={() => <LibraryPage {...props} />} />
          <Route
            path="/coverage"
            component={() => <CoveragePage {...props} />}
          />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      )}
    </StudioShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <StudioRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
