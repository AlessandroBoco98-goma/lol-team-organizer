import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import SessionForm from "./pages/SessionForm";
import SessionDetail from "./pages/SessionDetail";
import Players from "./pages/Players";
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-10">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<SessionForm />} />
            <Route path="/edit/:id" element={<SessionForm />} />
            <Route path="/session/:id" element={<SessionDetail />} />
            <Route path="/players" element={<Players />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
