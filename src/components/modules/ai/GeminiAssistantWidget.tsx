"use client";

import React, { useState, useRef, useEffect } from "react";
import { useApp } from "@/lib/state";
import { askGeminiAssistant } from "@/lib/gemini-ai";
import { Bot, Sparkles, Send, X, Shield, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export function GeminiAssistantWidget() {
  const { currentUser, clients, nodes, policies, tickets, expenses, vault } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `👋 ¡Hola ${currentUser.displayName}! Soy el Asistente IA de INNTEL CORP (Gemini Flash 2.5 Lite). Puedo apoyarte en consultas de pólizas ARCOTEL, estado de nodos MikroTik, órdenes de cobro o redacción de oficios. ¿En qué te puedo colaborar hoy?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const contextData = {
        currentUser,
        clientsCount: clients.length,
        clients: clients.map((c) => ({ name: c.businessName, ruc: c.identificationNumber, balance: c.currentBalance })),
        nodes: nodes.map((n) => ({ name: n.name, capacity: `${n.usedCapacityMbps}/${n.totalCapacityMbps} Mbps`, status: n.status })),
        policies: policies.map((p) => ({ num: p.policyNumber, status: p.status, expires: p.expirationDate })),
        tickets: tickets.map((t) => ({ id: t.ticketNumber, title: t.title, status: t.status })),
        expensesTotal: expenses.reduce((acc, e) => acc + e.amount, 0),
        vaultServices: vault.map((v) => v.serviceName),
      };

      const aiResponse = await askGeminiAssistant(textToSend, currentUser.role, contextData);

      const assistantMsg: Message = {
        role: "assistant",
        content: aiResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTED_PROMPTS = [
    "¿Qué pólizas de ARCOTEL vencen pronto?",
    "¿Cuál es el resumen de gastos y utilidad del mes?",
    "¿Cómo está la capacidad de los nodos y MikroTik?",
    "Generar borrador de oficio para renovación ARCOTEL",
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl shadow-lumina-dropdown hover:scale-105 transition-all duration-200 font-bold text-xs group cursor-pointer"
      >
        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
        <span>Asistente IA INNTEL</span>
      </button>

      {isOpen && (
        <div className="fixed bottom-22 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[560px] bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          <div className="p-3.5 bg-[#004ac6] text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-xs flex items-center justify-center text-amber-300 font-bold shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold flex items-center gap-1.5">
                  Asistente IA Gemini
                  <span className="px-1.5 py-0.2 bg-white/20 text-white rounded text-[9px] font-mono">
                    Flash 2.5 Lite
                  </span>
                </h3>
                <p className="text-[10px] text-blue-100 flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" /> Rol activo: {currentUser.role.toUpperCase()}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[#f8f9ff] text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-lg bg-[#004ac6] text-white flex items-center justify-center shrink-0 text-[10px] font-bold shadow-xs mt-0.5">
                    IA
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#004ac6] text-white rounded-br-xs shadow-xs font-medium"
                      : "bg-white text-[#0b1c30] rounded-bl-xs border border-[#e2e8f0] shadow-2xs whitespace-pre-line"
                  }`}
                >
                  <p>{m.content}</p>
                  <span
                    className={`block text-[9px] mt-1.5 text-right ${
                      m.role === "user" ? "text-blue-200" : "text-[#737686]"
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-[#737686] text-xs italic p-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#004ac6]" />
                Consultando Gemini Flash con contexto de telecomunicaciones...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-3 py-2 bg-white border-t border-[#e2e8f0] flex gap-1.5 overflow-x-auto no-scrollbar">
            {SUGGESTED_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p)}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-[#f8f9ff] hover:bg-[#eff4ff] text-[#434655] hover:text-[#004ac6] text-[10px] font-semibold transition-colors shrink-0 border border-[#cbd5e1] cursor-pointer"
              >
                {p}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-[#e2e8f0] flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Pregunta sobre clientes, ARCOTEL, MikroTik o finanzas..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-white text-xs text-[#0b1c30] rounded-lg px-3 py-2 border border-[#cbd5e1] focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6]"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2 rounded-lg bg-[#004ac6] hover:bg-[#2563eb] text-white disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
