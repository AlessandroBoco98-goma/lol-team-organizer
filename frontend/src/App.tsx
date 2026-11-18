import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import SessionForm from "./pages/SessionForm";
import SessionDetail from "./pages/SessionDetail";
import Players from "./pages/Players";
import Navbar from "./components/Navbar";

// Il key sul percorso rimonta la pagina e rilancia l'animazione di ingresso a ogni navigazione
function AnimatedRoutes() {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="animate-fade-up">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new" element={<SessionForm />} />
        <Route path="/edit/:id" element={<SessionForm />} />
        <Route path="/session/:id" element={<SessionDetail />} />
        <Route path="/players" element={<Players />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <AnimatedRoutes />
        </main>
        <footer className="pb-8 text-center font-display text-[10px] uppercase tracking-[0.3em] text-lol-text/25">
          LoL Team Organizer
        </footer>
      </div>
    </Router>
  );
}
