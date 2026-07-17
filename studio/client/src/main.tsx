import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { App } from "./App.tsx";
import { CharactersPage } from "./pages/CharactersPage.tsx";
import { CharacterDetailPage } from "./pages/CharacterDetailPage.tsx";
import { DoctorPage } from "./pages/DoctorPage.tsx";
import { NewCharacterPage } from "./pages/NewCharacterPage.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/characters" replace />} />
          <Route path="characters" element={<CharactersPage />} />
          <Route path="characters/new" element={<NewCharacterPage />} />
          <Route path="characters/:id" element={<CharacterDetailPage />} />
          <Route path="characters/:id/:section" element={<CharacterDetailPage />} />
          <Route
            path="characters/:id/:section/*"
            element={<CharacterDetailPage />}
          />
          <Route path="doctor" element={<DoctorPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
