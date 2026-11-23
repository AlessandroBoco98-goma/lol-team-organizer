import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { LazyMotion } from "motion/react";
import { Toaster } from "sonner";
import Navbar from "./components/Navbar";
import LoadingSpinner from "./components/LoadingSpinner";

// Ogni pagina è un pezzo a parte: si scarica solo quando serve
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SessionForm = lazy(() => import("./pages/SessionForm"));
const SessionDetail = lazy(() => import("./pages/SessionDetail"));
const Players = lazy(() => import("./pages/Players"));
const Vote = lazy(() => import("./pages/Vote"));

const loadMotionFeatures = () => import("./lib/motionFeatures").then((m) => m.default);

// Il key sul percorso rimonta la pagina a ogni navigazione: dissolvenza breve, nessuno spostamento
function AnimatedRoutes() {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="animate-fade-in">
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<SessionForm />} />
          <Route path="/edit/:id" element={<SessionForm />} />
          <Route path="/session/:id" element={<SessionDetail />} />
          <Route path="/players" element={<Players />} />
          <Route path="/vota" element={<Vote />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <Router>
        <div className="min-h-screen">
          <Navbar />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
            <AnimatedRoutes />
          </main>
        </div>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#0c1422",
              border: "1px solid rgb(201 169 106 / 0.35)",
              color: "#e9e4d6",
              borderRadius: 0,
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </Router>
    </LazyMotion>
  );
}
