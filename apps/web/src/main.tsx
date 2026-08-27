import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { App } from "./App";
import { RoomPage } from "./components/RoomPage";
import "./index.css";

const client = new QueryClient();
const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/rooms/:roomId", element: <RoomPage /> }
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
