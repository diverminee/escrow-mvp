"use client";

import { Header } from "@/components/layout/Header";
import { DisputeList } from "@/components/dispute/DisputeList";

export default function DisputesPage() {
  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: "var(--bg-base)", 
        color: "var(--text-primary)",
        minHeight: "100vh"
      }}
    >
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
        
        {/* Page Header */}
        <div className="mb-8 animate-in">
          <p 
            className="section-label mb-2"
            style={{ 
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.15em",
              textTransform: "uppercase"
            }}
          >
            Resolution
          </p>
          <h1 
            className="page-heading"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "2rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.2
            }}
          >
            Disputes
          </h1>
        </div>
        
        <div 
          className="card animate-in animate-in-delay-1" 
          style={{ 
            padding: "1.5rem",
            overflow: "hidden"
          }}
        >
          <div className="accent-line" />
          <DisputeList />
        </div>
      </main>
    </div>
  );
}
