"use client";

import { db } from "@/lib/firebase/config";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";

const codes = [
  "38685562",
  "83751970",
  "12561472",
  "95871287",
  "44289151",
  "50196184",
  "22162800",
  "74076266",
  "68277977",
  "97570239",
  "62835095",
  "36800215",
  "34864534",
  "20935581",
  "19136582"
];

export default function SeedPage() {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    setLoading(true);
    setStatus("Seeding items...");
    try {
      for (const code of codes) {
        await setDoc(doc(db, "registration_codes", code), {
          used: false,
          usedBy: null,
          createdAt: new Date().toISOString()
        });
        setStatus(`Added code: ${code}`);
      }
      setStatus("Success! 15 codes seeded. You can now delete this file/route.");
    } catch (err: any) {
      setStatus("Error seeding codes: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black text-black dark:text-white">
      <h1 className="text-2xl font-bold">Seed Registration Codes</h1>
      <p className="max-w-md text-center text-sm text-zinc-600 dark:text-zinc-400">
        Click the button below to add the 15 user registration codes into Firestore.
        After seeing the success message, **please delete this file/route** (`src/app/admin/seed/page.tsx`) to secure your app.
      </p>
      <button
        onClick={handleSeed}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-lg shadow-blue-500/20"
      >
        {loading ? "Adding..." : "Seed Codes"}
      </button>
      {status && (
        <p className="text-sm font-medium mt-2 text-blue-600 dark:text-blue-400">{status}</p>
      )}
    </div>
  );
}
