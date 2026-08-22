import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import {
  Play, Pause, AlertTriangle, AlertOctagon, CheckCircle2, WifiOff,
  Truck, ChevronDown, ChevronRight, ChevronLeft, Radio, Gauge as GaugeIcon,
  SkipForward, FileSpreadsheet, MapPin, Building2, Users, Fuel, Hash, TrendingDown, Activity, CalendarClock, Bell,
} from "lucide-react";
import * as XLSX from "xlsx-js-style";

/* ---------------------------------------------------------------------
   TOKENS
--------------------------------------------------------------------- */
const COLORS = {
  bg: "#0D1116", panel: "#151B22", panelAlt: "#1A222B", border: "#26303B",
  text: "#FFFFFF", muted: "#E4E9EF", faint: "#B7C0CC",
  green: "#3FBF7F", greenSoft: "rgba(63,191,127,0.14)",
  amber: "#E8A33D", amberSoft: "rgba(232,163,61,0.14)",
  red: "#E5545C", redSoft: "rgba(229,84,92,0.14)",
  blue: "#4FA6E0", blueSoft: "rgba(79,166,224,0.14)",
  purple: "#9A87E0", purpleSoft: "rgba(154,135,224,0.14)",
};
const TICKS_PER_DAY = 2;
const SEED_LEN = 14;

/* ---------------------------------------------------------------------
   SEEDED RNG (determinístico, pro mesmo conjunto sair igual a cada load)
--------------------------------------------------------------------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------------
   BASES / CIDADES
--------------------------------------------------------------------- */
const BASES = [
  { id: "araucaria", nome: "Araucária", gerente: "Renato", uf: "PR",
    cidades: ["Curitiba", "Araucária", "Campo Largo", "São José dos Pinhais"] },
  { id: "barueri", nome: "Barueri", gerente: "Roberto", uf: "SP",
    cidades: ["Barueri", "Santana de Parnaíba", "Osasco", "Cotia"] },
  { id: "canoas", nome: "Canoas", gerente: "Mauricio", uf: "RS",
    cidades: ["Canoas", "Porto Alegre", "Novo Hamburgo", "Gravataí"] },
  { id: "jandaia", nome: "Jandaia do Sul", gerente: "Marcelo", uf: "PR",
    cidades: ["Jandaia do Sul", "Apucarana", "Marialva", "Maringá"] },
];

const TIPOS = ["Mercado", "Padaria", "Restaurante", "Condomínio Residencial", "Indústria",
  "Hospital", "Posto de Combustíveis", "Hotel", "Lavanderia Industrial", "Churrascaria",
  "Pizzaria", "Clínica", "Escola", "Distribuidora", "Metalúrgica", "Panificadora",
  "Buffet", "Chácara", "Igreja", "Motel"];
const NOMES = ["São Francisco", "Bela Vista", "Jardim das Flores", "Santa Clara", "Bom Jesus",
  "Vale Verde", "Monte Alto", "Nova Esperança", "Boa Vista", "Três Marias",
  "São José", "Santa Luzia", "Alvorada", "Primavera", "União",
  "Central", "Ipê Amarelo", "Cedro", "Pinheiros", "Girassol"];
const RUAS = ["Rua das Palmeiras", "Av. Brasil", "Rua XV de Novembro", "Rua Sete de Setembro",
  "Av. Getúlio Vargas", "Rua Marechal Deodoro", "Rua Coronel Amazonas", "Av. Iguaçu",
  "Rua Paraná", "Rua Rio Grande do Sul"];
const BAIRROS = ["Centro", "Jardim América", "Vila Nova", "Boa Vista", "Industrial",
  "São Cristóvão", "Bela Vista", "Cidade Nova"];

const BEHAVIOR_PATTERN = ["normal", "normal", "normal", "anomalia_alta", "normal",
  "mal_dimensionado", "sensor_travado", "normal", "falha_sinal", "recem_abastecido"];
const NUMB190_PATTERN = [1, 2, 3, 4, 5, 6, 2, 3, 1, 4];

const FREQUENCIAS = ["semanal", "15dias", "21dias", "42dias", "mensal", "bimestral", "trimestral", "semestral", "anual"];
const FREQ_LABELS = {
  semanal: "Semanal", "15dias": "A cada 15 dias", "21dias": "A cada 21 dias", "42dias": "A cada 42 dias",
  mensal: "Mensal", bimestral: "Bimestral", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual",
};
const FREQ_DIAS = { semanal: 7, "15dias": 15, "21dias": 21, "42dias": 42, mensal: 30, bimestral: 60, trimestral: 90, semestral: 180, anual: 365 };
const DIAS_SEMANA = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

/* ---------------------------------------------------------------------
   GERAÇÃO DE CLIENTES
--------------------------------------------------------------------- */
function genSeed(cfg, rng) {
  const n = SEED_LEN;
  let level = cfg.seedEnd + cfg.baseRatePerTick * (n - 1);
  const pts = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) level = level - cfg.baseRatePerTick + (rng() - 0.5) * 0.4;
    pts.push({ tick: i, nivel: level });
  }
  if (cfg.freezeLastN > 0) {
    const freezeVal = pts[n - cfg.freezeLastN - 1].nivel;
    for (let i = n - cfg.freezeLastN; i < n; i++) pts[i].nivel = freezeVal + (rng() - 0.5) * 0.25;
  }
  return pts.map((p) => ({ tick: p.tick, nivel: +Math.max(2, Math.min(98, p.nivel)).toFixed(1) }));
}

function generateClients() {
  const rng = mulberry32(1337);
  const clients = [];
  let idx = 0;
  BASES.forEach((base) => {
    base.cidades.forEach((cidade) => {
      for (let i = 0; i < 10; i++) {
        const behavior = BEHAVIOR_PATTERN[i];
        const numB190 = NUMB190_PATTERN[i];
        const limiteAprendido = behavior === "mal_dimensionado" ? 50 : 30;
        const baseRatePerTick = +(1.2 + rng() * 1.0).toFixed(2);
        const seedEnd = behavior === "recem_abastecido" ? 22 + rng() * 6 : 38 + rng() * 28;
        const freezeLastN = behavior === "sensor_travado" ? 6 : 0;
        const offset = i % 5;

        const cfg = {
          behavior, baseRatePerTick, limiteAprendido, seedEnd, freezeLastN,
          anomalyStartTick: SEED_LEN + 4 + offset,
          failStartTick: SEED_LEN + 5 + offset,
          resupplyTick: SEED_LEN + 3 + offset,
        };

        const tipo = TIPOS[Math.floor(rng() * TIPOS.length)];
        const nome = `${tipo} ${NOMES[Math.floor(rng() * NOMES.length)]}`;
        const rua = RUAS[Math.floor(rng() * RUAS.length)];
        const bairro = BAIRROS[Math.floor(rng() * BAIRROS.length)];
        const numero = 80 + (idx * 37) % 900;
        const codigo = String(20000 + idx);
        const capacidadeKg = numB190 * 190;
        const seedAbastecimento = {
          diasAtras: 3 + Math.floor(rng() * 10),
          antesPct: +(14 + rng() * 10).toFixed(1),
          depoisPct: +(74 + rng() * 6).toFixed(1),
        };
        const frequencia = FREQUENCIAS[Math.floor(rng() * FREQUENCIAS.length)];
        const diaSemana = DIAS_SEMANA[Math.floor(rng() * DIAS_SEMANA.length)];

        let history = genSeed(cfg, rng);
        if (behavior === "falha_sinal" && rng() < 0.55) {
          history = history.slice(0, -(2 + Math.floor(rng() * 3))); // já está sem sinal desde o carregamento
        }

        clients.push({
          id: `${base.id}-${cidade}-${i}`.replace(/\s+/g, "_"),
          nome, codigo, baseId: base.id, baseNome: base.nome, gerente: base.gerente,
          cidade, uf: base.uf, endereco: `${rua}, ${numero} - ${bairro} - ${cidade}/${base.uf}`,
          numB190, capacidadeKg, seedAbastecimento, frequencia, diaSemana,
          config: cfg, history,
        });
        idx++;
      }
    });
  });
  return clients;
}

/* ---------------------------------------------------------------------
   SIMULAÇÃO / MÉTRICAS
--------------------------------------------------------------------- */
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const ANCHOR_DAY_INDEX = Math.floor((SEED_LEN - 1) / 2); // tick "atual" no load = hoje

function tickToDate(tick) {
  const dayIndex = Math.floor(tick / 2) - ANCHOR_DAY_INDEX;
  const d = new Date(TODAY);
  d.setDate(d.getDate() + dayIndex);
  return d;
}
function formatDate(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatTickLabel(tick) {
  const period = tick % 2 === 0 ? "Manhã" : "Tarde";
  return `${formatDate(tickToDate(tick))} · ${period}`;
}

function advanceClient(client, newTick) {
  const cfg = client.config;
  const lastPoint = client.history[client.history.length - 1];
  if (cfg.behavior === "falha_sinal" && newTick >= cfg.failStartTick) return client;

  const last = lastPoint.nivel;
  let nivel;
  if (cfg.behavior === "sensor_travado") {
    nivel = last + (Math.random() - 0.5) * 0.2;
  } else if (cfg.behavior === "anomalia_alta") {
    const rate = newTick >= cfg.anomalyStartTick ? cfg.baseRatePerTick * 2.5 : cfg.baseRatePerTick;
    nivel = last - rate + (Math.random() - 0.5) * 0.3;
  } else if (cfg.behavior === "recem_abastecido" && newTick === cfg.resupplyTick) {
    nivel = 76 + Math.random() * 6; // caminhão chegou — nunca passa de ~80% (margem de vaporização)
  } else {
    nivel = last - cfg.baseRatePerTick + (Math.random() - 0.5) * 0.3;
  }
  if (nivel <= 4 && cfg.behavior !== "sensor_travado") nivel = 76 + Math.random() * 6;
  nivel = +Math.max(0, Math.min(82, nivel)).toFixed(1); // teto físico realista
  return { ...client, history: [...client.history, { tick: newTick, nivel }] };
}

function computeMetrics(client, globalTick) {
  const hist = client.history;
  const last = hist[hist.length - 1];
  const cfg = client.config;
  const ticksSinceSignal = globalTick - last.tick;
  const semSinal = ticksSinceSignal >= 2;

  let lastResupplyIdx = -1;
  const resupplyEvents = [];
  for (let i = 1; i < hist.length; i++) {
    if (hist[i].nivel - hist[i - 1].nivel > 5) { lastResupplyIdx = i; resupplyEvents.push(i); }
  }
  const windowPts = lastResupplyIdx >= 0 ? hist.slice(lastResupplyIdx) : hist;
  const win = windowPts.length >= 2 ? windowPts : hist.slice(-6);

  let recentRate = cfg.baseRatePerTick;
  if (win.length >= 2) recentRate = (win[0].nivel - win[win.length - 1].nivel) / (win.length - 1);

  const tailForFlat = hist.slice(-6);
  const mean = tailForFlat.reduce((s, p) => s + p.nivel, 0) / tailForFlat.length;
  const variance = tailForFlat.reduce((s, p) => s + (p.nivel - mean) ** 2, 0) / tailForFlat.length;
  const sensorParado = tailForFlat.length >= 5 && Math.sqrt(variance) < 0.4;
  const consumoAnomalo = recentRate > cfg.baseRatePerTick * 1.6 && recentRate > 0.6;

  const taxaDiaria = recentRate * TICKS_PER_DAY;
  let diasEstimados = Infinity;
  if (recentRate > 0.05) diasEstimados = Math.max(0, (last.nivel - cfg.limiteAprendido) / taxaDiaria);

  let status = "ok", motivo = "Consumo dentro do padrão histórico do cliente.";
  if (semSinal) { status = "falha"; motivo = `Sem leitura recebida há ${ticksSinceSignal} ciclos.`; }
  else if (last.nivel <= cfg.limiteAprendido) { status = "critico"; motivo = "Nível já atingiu o limite de risco aprendido."; }
  else if (isFinite(diasEstimados) && diasEstimados <= 2.5) { status = "atencao"; motivo = `Projeção indica ${diasEstimados.toFixed(1)} dia(s) até o limite.`; }
  else if (sensorParado) { status = "atencao"; motivo = "Sinal sem variação — possível falha do magnétron."; }
  else if (consumoAnomalo) { status = "atencao"; motivo = "Taxa de consumo acima do padrão histórico."; }

  return { nivelAtual: last.nivel, lastTick: last.tick, semSinal, ticksSinceSignal, recentRate,
    taxaDiaria, diasEstimados, sensorParado, consumoAnomalo, resupplyEvents, status, motivo };
}

function buildChartData(client, metrics) {
  const hist = client.history;
  const data = hist.map((p) => ({ tick: p.tick, label: formatTickLabel(p.tick), nivel: p.nivel, projecao: null }));
  if (metrics.recentRate > 0.05 && isFinite(metrics.diasEstimados)) {
    const lastPoint = hist[hist.length - 1];
    const steps = Math.max(1, Math.min(20, Math.round(metrics.diasEstimados * TICKS_PER_DAY) + 1));
    let level = lastPoint.nivel;
    data[data.length - 1] = { ...data[data.length - 1], projecao: level };
    for (let i = 1; i <= steps; i++) {
      level = Math.max(client.config.limiteAprendido - 3, level - metrics.recentRate);
      data.push({ tick: lastPoint.tick + i, label: formatTickLabel(lastPoint.tick + i), nivel: null, projecao: +level.toFixed(1) });
    }
  }
  return data;
}

function getPrevisao(client, metrics) {
  if (metrics.semSinal) return { label: "indisponível", sub: "sem leitura recente" };
  if (metrics.nivelAtual <= client.config.limiteAprendido) return { label: "hoje", sub: formatDate(TODAY) };
  if (isFinite(metrics.diasEstimados)) {
    const dias = Math.ceil(metrics.diasEstimados);
    const d = new Date(TODAY); d.setDate(d.getDate() + dias);
    return { label: formatDate(d), sub: dias === 0 ? "hoje" : `em ${dias} dia(s)` };
  }
  return { label: "sem previsão", sub: "consumo estável demais pra projetar" };
}

function getAbastecimento(client, metrics) {
  if (metrics.resupplyEvents.length > 0) {
    const idx = metrics.resupplyEvents[metrics.resupplyEvents.length - 1];
    const antesPct = client.history[idx - 1].nivel, depoisPct = client.history[idx].nivel;
    return { quando: formatTickLabel(client.history[idx].tick), antesPct, depoisPct, detectadoAoVivo: true };
  }
  const s = client.seedAbastecimento;
  const d = new Date(TODAY);
  d.setDate(d.getDate() - s.diasAtras);
  return { quando: `${formatDate(d)} (há ${s.diasAtras} dias)`, antesPct: s.antesPct, depoisPct: s.depoisPct, detectadoAoVivo: false };
}

const STATUS_META = {
  ok: { label: "Normal", color: COLORS.green, bg: COLORS.greenSoft, icon: CheckCircle2, rank: 3 },
  atencao: { label: "Atenção", color: COLORS.amber, bg: COLORS.amberSoft, icon: AlertTriangle, rank: 1 },
  critico: { label: "Crítico", color: COLORS.red, bg: COLORS.redSoft, icon: AlertOctagon, rank: 0 },
  falha: { label: "Sem sinal", color: COLORS.purple, bg: COLORS.purpleSoft, icon: WifiOff, rank: 2 },
};

/* ---------------------------------------------------------------------
   GAUGE + SPARKLINE
--------------------------------------------------------------------- */
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}
const angleForLevel = (level) => Math.max(0, Math.min(100, level)) * 1.8;

const FULL_LEVEL = 80; // GLP nunca enche além disso — margem de vaporização

function Gauge({ level, limite, size = 200 }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 14;
  const meta = level <= limite ? STATUS_META.critico : level <= limite + 15 ? STATUS_META.atencao : STATUS_META.ok;
  const needleEnd = polarToCartesian(cx, cy, r - 18, angleForLevel(level));
  const fullTickInner = polarToCartesian(cx, cy, r - 7, angleForLevel(FULL_LEVEL));
  const fullTickOuter = polarToCartesian(cx, cy, r + 7, angleForLevel(FULL_LEVEL));
  const fullLabelPos = polarToCartesian(cx, cy, r + 18, angleForLevel(FULL_LEVEL));
  return (
    <svg width={size} height={size / 1.7 + 14} viewBox={`0 0 ${size} ${size / 1.7 + 20}`}>
      <path d={describeArc(cx, cy, r, angleForLevel(0), angleForLevel(limite))} stroke={COLORS.red} strokeWidth={12} fill="none" strokeLinecap="round" opacity={0.85} />
      <path d={describeArc(cx, cy, r, angleForLevel(limite), angleForLevel(Math.min(FULL_LEVEL, limite + 15)))} stroke={COLORS.amber} strokeWidth={12} fill="none" opacity={0.85} />
      <path d={describeArc(cx, cy, r, angleForLevel(Math.min(FULL_LEVEL, limite + 15)), angleForLevel(FULL_LEVEL))} stroke={COLORS.green} strokeWidth={12} fill="none" strokeLinecap="round" opacity={0.85} />
      <path d={describeArc(cx, cy, r, angleForLevel(FULL_LEVEL), angleForLevel(100))} stroke={COLORS.faint} strokeWidth={12} fill="none" strokeLinecap="round" opacity={0.35} />
      <line x1={fullTickInner.x} y1={fullTickInner.y} x2={fullTickOuter.x} y2={fullTickOuter.y} stroke={COLORS.text} strokeWidth={2} />
      <text x={fullLabelPos.x} y={fullLabelPos.y} textAnchor="middle" fill={COLORS.muted} style={{ fontSize: 9, fontWeight: 600 }}>CHEIO</text>
      <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y} stroke={COLORS.text} strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill={COLORS.text} />
      <text x={cx} y={cy - 26} textAnchor="middle" fill={meta.color} style={{ fontSize: 30, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{level.toFixed(1)}%</text>
      <text x={cx - r + 6} y={cy + 16} textAnchor="start" fill={COLORS.faint} style={{ fontSize: 10 }}>0%</text>
      <text x={cx + r - 6} y={cy + 16} textAnchor="end" fill={COLORS.faint} style={{ fontSize: 10 }}>100%</text>
    </svg>
  );
}

function Sparkline({ history, color, width = 96, height = 30 }) {
  const pts = history.slice(-14);
  const vals = pts.map((p) => p.nivel);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const coords = pts.map((p, i) => {
    const x = (i / Math.max(1, pts.length - 1)) * width;
    const y = height - ((p.nivel - min) / span) * (height - 6) - 3;
    return `${x},${y}`;
  });
  const last = coords[coords.length - 1]?.split(",");
  return (
    <svg width={width} height={height}>
      <polyline points={coords.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      {last && <circle cx={last[0]} cy={last[1]} r={3} fill={color} />}
    </svg>
  );
}

/* ---------------------------------------------------------------------
   PEQUENOS UTILITÁRIOS DE UI
--------------------------------------------------------------------- */
function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
      :root { --font-display:'Space Grotesk',sans-serif; --font-body:'Inter',sans-serif; --font-mono:'IBM Plex Mono',monospace; }
      .tg-btn:focus-visible, .tg-row:focus-visible, .tg-slider:focus-visible, .tg-card:focus-visible, .tg-basecard:focus-visible { outline: 2px solid ${COLORS.blue}; outline-offset: 2px; }
      @keyframes tgPulse { 0%{opacity:1; transform:scale(1);} 100%{opacity:0; transform:scale(2.4);} }
      @keyframes tgFadeIn { 0%{opacity:0; transform:translateY(-2px);} 100%{opacity:1; transform:translateY(0);} }
      .tg-ping { animation: tgFadeIn .5s ease-out; }
      .tg-livedot { position:relative; width:9px; height:9px; border-radius:50%; background:${COLORS.green}; }
      .tg-livedot::after { content:''; position:absolute; inset:0; border-radius:50%; background:${COLORS.green}; animation: tgPulse 1.4s ease-out infinite; }
      input[type=range].tg-slider { accent-color:${COLORS.blue}; }
      .tg-grid-row { display:grid; grid-template-columns: 1.7fr .9fr .8fr .8fr 1fr 20px; align-items:center; gap:6px; }
      .tg-card { cursor:pointer; transition: transform .12s ease; text-align:left; }
      .tg-card:hover { transform: translateY(-1px); }
      .tg-basecard { cursor:pointer; transition: transform .12s ease, border-color .12s ease; text-align:left; }
      .tg-basecard:hover { transform: translateY(-2px); border-color:${COLORS.blue}66 !important; }
      .tg-detail-grid { display:grid; grid-template-columns:1fr; gap:20px; min-width:0; }
      @media (max-width:640px) {
        .tg-grid-row { grid-template-columns: 1.4fr .8fr 1fr 20px; }
        .tg-hide-mobile { display:none !important; }
      }
      @media (min-width:680px) { .tg-detail-grid { grid-template-columns:220px 1fr; } }
    `}</style>
  );
}

function TopBar({ title, subtitle, onBack, running, setRunning, speedSec, setSpeedSec, tick, globalTick, onExport }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 14, marginBottom: 16 }}>
      <div style={{ minWidth: 0 }}>
        {onBack && (
          <button className="tg-btn" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: COLORS.blue, fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 8 }}>
            <ChevronLeft size={15} /> Voltar
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.blue, fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: 1, marginBottom: 5 }}>
          <Radio size={12} /> TELEMETRIA GLP
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.4 }}>{title}</h1>
        {subtitle && <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 4, maxWidth: 480 }}>{subtitle}</p>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "9px 12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
          {running ? <span className="tg-livedot" /> : <span style={{ width: 9, height: 9, borderRadius: "50%", background: COLORS.faint, display: "inline-block" }} />}
          <span style={{ color: running ? COLORS.green : COLORS.muted }}>{running ? "AO VIVO" : "PARADO"}</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: COLORS.muted }}>{formatTickLabel(globalTick)}</span>
        <button className="tg-btn" onClick={() => setRunning((r) => !r)} style={{ display: "flex", alignItems: "center", gap: 5, background: running ? COLORS.redSoft : COLORS.greenSoft, color: running ? COLORS.red : COLORS.green, border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          {running ? <Pause size={13} /> : <Play size={13} />} {running ? "Parar" : "Iniciar"}
        </button>
        <button className="tg-btn" onClick={tick} title="Avançar uma leitura" style={{ display: "flex", alignItems: "center", background: COLORS.panelAlt, color: COLORS.muted, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 9px", cursor: "pointer" }}>
          <SkipForward size={12} />
        </button>
        <input className="tg-slider" type="range" min={1} max={10} step={0.5} value={speedSec} onChange={(e) => setSpeedSec(+e.target.value)} style={{ width: 80 }} title={`${speedSec}s / leitura`} />
        {onExport && (
          <button className="tg-btn" onClick={onExport} style={{ display: "flex", alignItems: "center", gap: 5, background: COLORS.blueSoft, color: COLORS.blue, border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <FileSpreadsheet size={13} /> Excel
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   PAINEL AO VIVO — visão nacional (todas as bases), donut + tendência
--------------------------------------------------------------------- */
function LiveOverview({ counts, total, running, setRunning, speedSec, setSpeedSec, globalTick, onOpenAlerts }) {
  const alertCount = counts.critico + counts.atencao;
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={16} color={COLORS.blue} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700 }}>Panorama de todas as bases</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font-mono)", fontSize: 11 }}>
            {running ? <span className="tg-livedot" /> : <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.faint, display: "inline-block" }} />}
            <span style={{ color: running ? COLORS.green : COLORS.muted }}>{running ? "AO VIVO" : "PARADO"}</span>
            <span style={{ color: COLORS.faint }}>· {formatTickLabel(globalTick)}</span>
          </div>
          <button className="tg-btn" onClick={() => setRunning((r) => !r)} style={{ display: "flex", alignItems: "center", gap: 5, background: running ? COLORS.redSoft : COLORS.greenSoft, color: running ? COLORS.red : COLORS.green, border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {running ? <Pause size={12} /> : <Play size={12} />} {running ? "Parar" : "Iniciar"}
          </button>
          <input className="tg-slider" type="range" min={1} max={10} step={0.5} value={speedSec} onChange={(e) => setSpeedSec(+e.target.value)} style={{ width: 70 }} title={`${speedSec}s / leitura`} />
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700 }}>{total}</div>
          <div style={{ fontSize: 9.5, color: COLORS.faint, letterSpacing: 0.3 }}>CLIENTES</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, flex: "1 1 260px", minWidth: 240 }}>
          {["critico", "falha", "atencao", "ok"].map((s) => {
            const meta = STATUS_META[s], Icon = meta.icon;
            const clickable = s === "critico" || s === "atencao";
            return (
              <div key={s} role={clickable ? "button" : undefined} tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onOpenAlerts() : undefined}
                onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenAlerts(); } } : undefined}
                style={{ background: meta.bg, border: `1px solid ${meta.color}33`, borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: clickable ? "pointer" : "default" }}>
                <div>
                  <div style={{ fontSize: 10.5, color: meta.color, fontWeight: 600, letterSpacing: 0.3 }}>{meta.label.toUpperCase()}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: COLORS.text }}>{counts[s]}</div>
                </div>
                <Icon size={18} color={meta.color} />
              </div>
            );
          })}
        </div>
      </div>

      <div role="button" tabIndex={0} onClick={onOpenAlerts}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenAlerts(); } }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
          background: alertCount > 0 ? COLORS.redSoft : COLORS.panelAlt, border: `1px solid ${alertCount > 0 ? COLORS.red + "55" : COLORS.border}`,
          borderRadius: 12, padding: "12px 16px", flexWrap: "wrap", gap: 8,
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Bell size={16} color={alertCount > 0 ? COLORS.red : COLORS.muted} />
          <span style={{ fontSize: 13, fontWeight: 700, color: alertCount > 0 ? COLORS.red : COLORS.text }}>Central de Alertas</span>
          <span style={{ fontSize: 12, color: COLORS.muted }}>clientes que precisam de abastecimento fora da rota programada</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: alertCount > 0 ? COLORS.red : COLORS.muted }}>{alertCount}</span>
          <ChevronRight size={16} color={COLORS.muted} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   TELA 1 — SELEÇÃO DE BASE
--------------------------------------------------------------------- */
function BaseSelectScreen({ enrichedAll, onPick, liveProps, onOpenAlerts }) {
  return (
    <div style={{ maxWidth: 900, margin: "40px auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.blue, fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>
        <Radio size={13} /> TELEMETRIA GLP
      </div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, margin: "0 0 4px", color: COLORS.text }}>Qual base você quer acompanhar?</h1>
      <p style={{ color: COLORS.muted, fontSize: 13.5, marginBottom: 16 }}>Selecione a base para abrir o painel de indicadores.</p>

      <LiveOverview {...liveProps} onOpenAlerts={onOpenAlerts} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
        {BASES.map((base) => {
          const clientes = enrichedAll.filter((c) => c.baseId === base.id);
          const critico = clientes.filter((c) => c.metrics.status === "critico").length;
          return (
            <button key={base.id} className="tg-basecard" onClick={() => onPick(base.id)}
              style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, color: COLORS.text, font: "inherit" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Building2 size={18} color={COLORS.blue} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700 }}>Base {base.nome}</span>
              </div>
              <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 3 }}>Gerente: <b style={{ color: COLORS.text }}>{base.gerente}</b></div>
              <div style={{ fontSize: 12.5, color: COLORS.faint, marginBottom: 14 }}>{base.cidades.join(" · ")}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: COLORS.muted }}>
                  <Users size={13} /> {clientes.length} clientes
                </div>
                {critico > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, background: COLORS.redSoft, color: COLORS.red, padding: "3px 8px", borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>
                    <AlertOctagon size={11} /> {critico} crítico(s)
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   TELA 2 — DASHBOARD (base ou cidade)
--------------------------------------------------------------------- */
function DashboardScreen({ base, city, setCity, scopeClients, allBaseClients, onIndicatorClick, onSeeAll, onDrillCity, ...topBarProps }) {
  const counts = useMemo(() => {
    const b = { ok: 0, atencao: 0, critico: 0, falha: 0 };
    scopeClients.forEach((c) => b[c.metrics.status]++);
    return b;
  }, [scopeClients]);

  const cityBreakdown = useMemo(() => {
    if (city !== "all") return [];
    return base.cidades.map((cid) => {
      const list = allBaseClients.filter((c) => c.cidade === cid);
      const b = { ok: 0, atencao: 0, critico: 0, falha: 0 };
      list.forEach((c) => b[c.metrics.status]++);
      return { cidade: cid, total: list.length, ...b };
    });
  }, [city, base, allBaseClients]);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", minWidth: 0 }}>
      <TopBar title={`Base ${base.nome}`} subtitle={`Gerente responsável: ${base.gerente} · ${city === "all" ? "todas as cidades" : city}`} {...topBarProps} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <button onClick={() => setCity("all")} style={{
          background: city === "all" ? COLORS.blueSoft : COLORS.panel, color: city === "all" ? COLORS.blue : COLORS.muted,
          border: `1px solid ${city === "all" ? COLORS.blue + "55" : COLORS.border}`, borderRadius: 20, padding: "6px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        }}>Todas as cidades</button>
        {base.cidades.map((cid) => (
          <button key={cid} onClick={() => setCity(cid)} style={{
            background: city === cid ? COLORS.blueSoft : COLORS.panel, color: city === cid ? COLORS.blue : COLORS.muted,
            border: `1px solid ${city === cid ? COLORS.blue + "55" : COLORS.border}`, borderRadius: 20, padding: "6px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          }}>{cid}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 14 }}>
        {["critico", "falha", "atencao", "ok"].map((s) => {
          const meta = STATUS_META[s], Icon = meta.icon;
          return (
            <button key={s} className="tg-card" onClick={() => onIndicatorClick(s)}
              style={{ background: meta.bg, border: `1px solid ${meta.color}33`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", font: "inherit", color: "inherit" }}>
              <div>
                <div style={{ fontSize: 11, color: meta.color, fontWeight: 600, letterSpacing: 0.3 }}>{meta.label.toUpperCase()}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: COLORS.text }}>{counts[s]}</div>
              </div>
              <Icon size={22} color={meta.color} />
            </button>
          );
        })}
      </div>

      <button onClick={onSeeAll} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: COLORS.blue, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 20 }}>
        Ver todos os {scopeClients.length} clientes <ChevronRight size={14} />
      </button>

      {city === "all" && (
        <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "10px 16px", fontSize: 11, color: COLORS.faint, letterSpacing: 0.4, borderBottom: `1px solid ${COLORS.border}` }}>POR CIDADE</div>
          {cityBreakdown.map((row) => (
            <button key={row.cidade} onClick={() => onDrillCity(row.cidade)} className="tg-card"
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, background: "none", border: "none", borderTop: "none", color: "inherit", font: "inherit" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <MapPin size={14} color={COLORS.muted} />
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{row.cidade}</span>
                <span style={{ fontSize: 11.5, color: COLORS.faint }}>({row.total} clientes)</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["critico", "falha", "atencao", "ok"].map((s) => row[s] > 0 && (
                  <span key={s} style={{ fontSize: 11, fontWeight: 600, color: STATUS_META[s].color, background: STATUS_META[s].bg, padding: "2px 7px", borderRadius: 20 }}>{row[s]}</span>
                ))}
                <ChevronRight size={15} color={COLORS.faint} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
   TELA 3 — LISTA DE CLIENTES
--------------------------------------------------------------------- */
function ListScreen({ base, city, statusFilter, setStatusFilter, list, onOpenClient, ...topBarProps }) {
  const sorted = useMemo(() => [...list].sort((a, b) => STATUS_META[a.metrics.status].rank - STATUS_META[b.metrics.status].rank), [list]);
  const title = statusFilter ? `${STATUS_META[statusFilter].label} — ${city === "all" ? "todas as cidades" : city}` : `Clientes — ${city === "all" ? "todas as cidades" : city}`;
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", minWidth: 0 }}>
      <TopBar title={title} subtitle={`Base ${base.nome} · Gerente ${base.gerente} · ${sorted.length} cliente(s)`} {...topBarProps} />
      {statusFilter && (
        <button onClick={() => setStatusFilter(null)} style={{ background: "none", border: "none", color: COLORS.blue, fontSize: 12.5, textDecoration: "underline", cursor: "pointer", padding: 0, marginBottom: 12 }}>
          limpar filtro de status
        </button>
      )}
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div className="tg-grid-row" style={{ padding: "10px 16px", fontSize: 11, color: COLORS.faint, letterSpacing: 0.4, borderBottom: `1px solid ${COLORS.border}` }}>
          <span>CLIENTE</span>
          <span className="tg-hide-mobile">CIDADE</span>
          <span className="tg-hide-mobile">B-190</span>
          <span>NÍVEL</span>
          <span>STATUS</span>
          <span />
        </div>
        {sorted.length === 0 && <div style={{ padding: 24, textAlign: "center", color: COLORS.faint, fontSize: 13 }}>Nenhum cliente neste filtro.</div>}
        {sorted.map((c) => {
          const meta = STATUS_META[c.metrics.status], Icon = meta.icon;
          const justUpdated = c.metrics.lastTick === topBarProps.globalTick;
          return (
            <div key={c.id} role="button" tabIndex={0}
              className="tg-row tg-grid-row"
              onClick={() => onOpenClient(c.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenClient(c.id); } }}
              style={{
                cursor: "pointer", boxSizing: "border-box", padding: "12px 16px",
                borderBottom: `1px solid ${COLORS.border}`, background: "transparent",
              }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</span>
                  {justUpdated && <span key={topBarProps.globalTick} className="tg-ping" style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 8.5, color: COLORS.blue, background: COLORS.blueSoft, padding: "1px 5px", borderRadius: 4 }}>SINAL</span>}
                </div>
                <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "var(--font-mono)" }}>{c.codigo}</div>
              </div>
              <div className="tg-hide-mobile" style={{ fontSize: 12, color: COLORS.muted }}>{c.cidade}</div>
              <div className="tg-hide-mobile" style={{ fontSize: 12, color: COLORS.muted, display: "flex", alignItems: "center", gap: 4 }}><Fuel size={12} /> {c.numB190}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600 }}>{c.metrics.semSinal ? "—" : `${c.metrics.nivelAtual.toFixed(0)}%`}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, background: meta.bg, color: meta.color, padding: "3px 8px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, width: "fit-content" }}>
                <Icon size={12} /> {meta.label}
              </div>
              <ChevronRight size={15} color={COLORS.muted} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   TELA 4 — DETALHE DO CLIENTE
--------------------------------------------------------------------- */
/* ---------------------------------------------------------------------
   TELA — CENTRAL DE ALERTAS (clientes que precisam de ação fora da rota)
--------------------------------------------------------------------- */
function AlertsScreen({ enrichedAll, onOpenClient, onBack, ...topBarProps }) {
  const actionList = useMemo(() => enrichedAll
    .filter((c) => c.metrics.status === "critico" || c.metrics.status === "atencao")
    .sort((a, b) => STATUS_META[a.metrics.status].rank - STATUS_META[b.metrics.status].rank
      || (a.metrics.diasEstimados - b.metrics.diasEstimados)), [enrichedAll]);
  const sinalList = useMemo(() => enrichedAll.filter((c) => c.metrics.status === "falha"), [enrichedAll]);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", minWidth: 0 }}>
      <TopBar title="Central de Alertas" subtitle="Clientes que precisam de abastecimento fora da rota programada, apontados automaticamente pela telemetria" onBack={onBack} {...topBarProps} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Bell size={15} color={COLORS.red} />
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>Precisam de ação ({actionList.length})</span>
      </div>

      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 22 }}>
        {actionList.length === 0 && <div style={{ padding: 24, textAlign: "center", color: COLORS.faint, fontSize: 13 }}>Nenhum cliente precisando de ação fora da rota no momento.</div>}
        {actionList.map((c) => {
          const meta = STATUS_META[c.metrics.status], Icon = meta.icon;
          const previsao = getPrevisao(c, c.metrics);
          return (
            <div key={c.id} role="button" tabIndex={0}
              onClick={() => onOpenClient(c)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenClient(c); } }}
              style={{ cursor: "pointer", padding: "14px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 700 }}>
                  <Icon size={14} color={meta.color} /> {c.nome}
                </div>
                <div style={{ fontSize: 11.5, color: COLORS.muted, marginTop: 2 }}>
                  {c.baseNome} · {c.cidade} · Gerente {c.gerente}
                </div>
                <div style={{ fontSize: 11, color: COLORS.faint, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                  <CalendarClock size={11} /> rota programada: {FREQ_LABELS[c.frequencia]} · {c.diaSemana}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 700, color: meta.color }}>{c.metrics.nivelAtual.toFixed(0)}%</div>
                <div style={{ fontSize: 11, color: COLORS.muted }}>limite: {c.config.limiteAprendido}%</div>
              </div>
              <div style={{ background: meta.bg, border: `1px solid ${meta.color}55`, borderRadius: 10, padding: "6px 10px", textAlign: "center", minWidth: 118 }}>
                <div style={{ fontSize: 9.5, color: meta.color, fontWeight: 700, letterSpacing: 0.3 }}>PRECISA ATÉ</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>{previsao.label}</div>
                <div style={{ fontSize: 10, color: COLORS.muted }}>{previsao.sub}</div>
              </div>
              <ChevronRight size={16} color={COLORS.muted} />
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <WifiOff size={15} color={COLORS.purple} />
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>Sinal perdido — verificar sensor ({sinalList.length})</span>
      </div>
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden" }}>
        {sinalList.length === 0 && <div style={{ padding: 24, textAlign: "center", color: COLORS.faint, fontSize: 13 }}>Nenhum cliente sem sinal no momento.</div>}
        {sinalList.map((c) => (
          <div key={c.id} role="button" tabIndex={0}
            onClick={() => onOpenClient(c)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenClient(c); } }}
            style={{ cursor: "pointer", padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.nome}</div>
              <div style={{ fontSize: 11.5, color: COLORS.muted }}>{c.baseNome} · {c.cidade} · sem leitura há {c.metrics.ticksSinceSignal} ciclos</div>
            </div>
            <ChevronRight size={16} color={COLORS.muted} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailScreen({ client, globalTick, onBack }) {
  const metrics = useMemo(() => computeMetrics(client, globalTick), [client, globalTick]);
  const chartData = useMemo(() => buildChartData(client, metrics), [client, metrics]);
  const abast = useMemo(() => getAbastecimento(client, metrics), [client, metrics]);
  const meta = STATUS_META[metrics.status];

  const antesKg = (abast.antesPct / 100) * client.capacidadeKg;
  const depoisKg = (abast.depoisPct / 100) * client.capacidadeKg;
  const entregueKg = depoisKg - antesKg;
  const consumoKgDia = (metrics.taxaDiaria / 100) * client.capacidadeKg;

  const previsao = getPrevisao(client, metrics);
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", minWidth: 0 }}>
      <button className="tg-btn" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: COLORS.blue, fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 14 }}>
        <ChevronLeft size={15} /> Voltar para a lista
      </button>

      <div style={{ marginBottom: 6 }}>
        <span style={{ background: meta.bg, color: meta.color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{meta.label}</span>
      </div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, margin: "4px 0 2px" }}>{client.nome}</h1>
      <div style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 4, display: "flex", flexWrap: "wrap", gap: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Hash size={12} /> {client.codigo}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {client.endereco}</span>
        <span>Base {client.baseNome} · Gerente {client.gerente}</span>
      </div>
      <div style={{ fontSize: 12, color: COLORS.faint, marginBottom: 14, display: "flex", alignItems: "center", gap: 5 }}>
        <Fuel size={12} /> {client.numB190} × B-190 ({client.capacidadeKg} kg de capacidade nominal · enche até ~80% por margem de vaporização)
      </div>

      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 18,
        background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <CalendarClock size={16} color={COLORS.blue} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{FREQ_LABELS[client.frequencia]} · {client.diaSemana}</div>
            <div style={{ fontSize: 10.5, color: COLORS.faint }}>frequência de rota contratada para este cliente</div>
          </div>
        </div>
        {isFinite(metrics.diasEstimados) && metrics.diasEstimados < FREQ_DIAS[client.frequencia] * 0.5 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: COLORS.amberSoft, color: COLORS.amber, padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>
            <AlertTriangle size={12} /> projeção atual ({metrics.diasEstimados.toFixed(1)}d) bem abaixo do padrão contratado ({FREQ_DIAS[client.frequencia]}d)
          </div>
        )}
      </div>

      <div className="tg-detail-grid">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Gauge level={metrics.nivelAtual} limite={client.config.limiteAprendido} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: COLORS.muted }}>
            <GaugeIcon size={13} /><span>Limite aprendido: <b style={{ color: COLORS.text }}>{client.config.limiteAprendido}%</b></span>
          </div>
          <div style={{ fontSize: 10.5, color: COLORS.faint, textAlign: "center" }}>calculado a partir do histórico deste cliente — sem preenchimento manual</div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 10 }}>{metrics.motivo}</div>
          <div style={{ height: 190, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id={`fill-${client.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={meta.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={COLORS.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: COLORS.faint, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fill: COLORS.faint, fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: COLORS.muted }} />
                <ReferenceLine y={client.config.limiteAprendido} stroke={COLORS.red} strokeDasharray="4 3" label={{ value: "limite", position: "insideTopRight", fill: COLORS.red, fontSize: 10 }} />
                <ReferenceLine y={FULL_LEVEL} stroke={COLORS.muted} strokeDasharray="2 4" label={{ value: "cheio (80%)", position: "insideBottomRight", fill: COLORS.muted, fontSize: 10 }} />
                <Area type="monotone" dataKey="nivel" stroke={meta.color} strokeWidth={2} fill={`url(#fill-${client.id})`} connectNulls dot={false} />
                <Line type="monotone" dataKey="projecao" stroke={COLORS.muted} strokeWidth={1.6} strokeDasharray="4 4" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
            background: meta.bg, border: `1px solid ${meta.color}44`, borderRadius: 12, padding: "12px 16px", marginTop: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CalendarClock size={16} color={meta.color} />
              <span style={{ fontSize: 12.5, color: COLORS.muted }}>Próximo abastecimento previsto</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: COLORS.text }}>{previsao.label}</div>
              <div style={{ fontSize: 11, color: COLORS.muted }}>{previsao.sub}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginTop: 10 }}>
            <Stat label="Taxa de consumo" value={`${metrics.taxaDiaria.toFixed(1)}%/dia`} sub={`≈ ${consumoKgDia.toFixed(1)} kg/dia`} />
            <Stat label="Dias até o limite" value={isFinite(metrics.diasEstimados) ? metrics.diasEstimados.toFixed(1) : "—"} />
            <Stat label="Leituras recebidas" value={client.history.length} />
            <Stat label="Última leitura" value={formatTickLabel(metrics.lastTick)} />
          </div>

          <div style={{ marginTop: 16, background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: COLORS.blue, marginBottom: 8, fontWeight: 600 }}>
              <Truck size={14} /> Último abastecimento {abast.detectadoAoVivo ? "(detectado ao vivo)" : "(registro anterior à simulação)"}
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 8 }}>{abast.quando}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
              <Stat label="Tinha antes" value={`${abast.antesPct.toFixed(1)}%`} sub={`≈ ${antesKg.toFixed(0)} kg`} />
              <Stat label="Ficou depois" value={`${abast.depoisPct.toFixed(1)}%`} sub={`≈ ${depoisKg.toFixed(0)} kg`} />
              <Stat label="Quantidade abastecida" value={`≈ ${entregueKg.toFixed(0)} kg`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "9px 12px" }}>
      <div style={{ fontSize: 10.5, color: COLORS.faint, marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600, color: COLORS.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: COLORS.muted, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------
   APP
--------------------------------------------------------------------- */
export default function TelemetriaSimulador() {
  const [clients, setClients] = useState(() => generateClients());
  const [globalTick, setGlobalTick] = useState(SEED_LEN - 1);
  const [running, setRunning] = useState(false);
  const [speedSec, setSpeedSec] = useState(3);
  const intervalRef = useRef(null);

  const [view, setView] = useState("baseSelect");
  const [returnView, setReturnView] = useState("list");
  const [baseId, setBaseId] = useState(null);
  const [city, setCity] = useState("all");
  const [statusFilter, setStatusFilter] = useState(null);
  const [clientId, setClientId] = useState(null);

  const tick = useCallback(() => {
    setGlobalTick((prev) => {
      const nt = prev + 1;
      setClients((prevClients) => prevClients.map((c) => advanceClient(c, nt)));
      return nt;
    });
  }, []);

  useEffect(() => {
    if (running) intervalRef.current = setInterval(tick, speedSec * 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, speedSec, tick]);

  const enrichedAll = useMemo(() => clients.map((c) => ({ ...c, metrics: computeMetrics(c, globalTick) })), [clients, globalTick]);

  const globalCounts = useMemo(() => {
    const b = { ok: 0, atencao: 0, critico: 0, falha: 0 };
    enrichedAll.forEach((c) => b[c.metrics.status]++);
    return b;
  }, [enrichedAll]);

  const base = BASES.find((b) => b.id === baseId) || null;
  const baseClients = useMemo(() => (base ? enrichedAll.filter((c) => c.baseId === base.id) : []), [base, enrichedAll]);
  const scopeClients = useMemo(() => (city === "all" ? baseClients : baseClients.filter((c) => c.cidade === city)), [baseClients, city]);
  const listClients = useMemo(() => (statusFilter ? scopeClients.filter((c) => c.metrics.status === statusFilter) : scopeClients), [scopeClients, statusFilter]);
  const selectedClient = enrichedAll.find((c) => c.id === clientId) || null;

  const exportScope = view === "list" ? listClients
    : view === "alerts" ? enrichedAll.filter((c) => c.metrics.status === "critico" || c.metrics.status === "atencao")
    : scopeClients;
  const handleExport = useCallback(() => {
    const headers = [
      "Cliente", "Código", "Cidade", "Status", "Nível atual (%)", "Limite aprendido (%)",
      "Taxa de consumo (%/dia)", "Dias até o limite", "Próximo abastecimento", "Última leitura",
      "Frequência", "Dia da rota", "B-190", "Endereço", "Motivo",
    ];
    const numCols = headers.length;
    const blankRow = Array(numCols).fill("");
    const padRow = (first) => [first, ...Array(numCols - 1).fill("")];

    const dataRows = exportScope.map((c) => {
      const m = c.metrics, previsao = getPrevisao(c, m);
      return [
        c.nome, c.codigo, c.cidade, STATUS_META[m.status].label,
        m.semSinal ? "—" : m.nivelAtual, c.config.limiteAprendido,
        +m.taxaDiaria.toFixed(2), isFinite(m.diasEstimados) ? +m.diasEstimados.toFixed(1) : "—",
        previsao.label, formatTickLabel(m.lastTick), FREQ_LABELS[c.frequencia], c.diaSemana,
        c.numB190, c.endereco, m.motivo,
      ];
    });

    const aoa = [
      padRow("CONSIGAZ"),
      padRow("Relatório de Telemetria GLP — Painel de Risco de Abastecimento"),
      padRow(`Base: ${base ? base.nome : "Todas as bases"}`),
      padRow(`Cidade: ${city === "all" ? "Todas as cidades" : city}`),
      padRow(`Gerado em: ${formatDate(new Date())} · ${exportScope.length} cliente(s)`),
      blankRow,
      headers,
      ...dataRows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = [0, 1, 2, 3, 4].map((r) => ({ s: { r, c: 0 }, e: { r, c: numCols - 1 } }));
    ws["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 13 }, { wch: 14 },
      { wch: 15 }, { wch: 13 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 34 }, { wch: 42 }];

    const NAVY = "1B3A5C", NAVY_LIGHT = "2E5479", WHITE = "FFFFFF", BORDER = "D9DEE4";
    const STATUS_HEX = { critico: "E5545C", falha: "9A87E0", atencao: "E8A33D", ok: "3FBF7F" };
    const thinBorder = { top: { style: "thin", color: { rgb: BORDER } }, bottom: { style: "thin", color: { rgb: BORDER } }, left: { style: "thin", color: { rgb: BORDER } }, right: { style: "thin", color: { rgb: BORDER } } };
    const setCell = (r, c, style) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) ws[addr].s = { ...(ws[addr].s || {}), ...style };
    };

    for (let c = 0; c < numCols; c++) setCell(0, c, { font: { bold: true, sz: 20, color: { rgb: WHITE } }, fill: { fgColor: { rgb: NAVY } }, alignment: { horizontal: "center", vertical: "center" } });
    for (let c = 0; c < numCols; c++) setCell(1, c, { font: { italic: true, sz: 11, color: { rgb: WHITE } }, fill: { fgColor: { rgb: NAVY_LIGHT } }, alignment: { horizontal: "center" } });
    for (const r of [2, 3, 4]) for (let c = 0; c < numCols; c++) setCell(r, c, { font: { bold: r !== 4, sz: 11, color: { rgb: NAVY } }, alignment: { horizontal: "left" } });

    for (let c = 0; c < numCols; c++) setCell(6, c, { font: { bold: true, sz: 10.5, color: { rgb: WHITE } }, fill: { fgColor: { rgb: NAVY } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: thinBorder });

    dataRows.forEach((_, i) => {
      const r = 7 + i;
      const banding = i % 2 === 0 ? "FFFFFF" : "F1F4F8";
      for (let c = 0; c < numCols; c++) setCell(r, c, { fill: { fgColor: { rgb: banding } }, border: thinBorder, font: { sz: 10.5 }, alignment: { vertical: "center" } });
      const statusHex = STATUS_HEX[exportScope[i].metrics.status];
      setCell(r, 3, { fill: { fgColor: { rgb: statusHex } }, font: { bold: true, sz: 10.5, color: { rgb: WHITE } }, border: thinBorder, alignment: { horizontal: "center", vertical: "center" } });
      setCell(r, 0, { font: { bold: true, sz: 10.5 }, fill: { fgColor: { rgb: banding } }, border: thinBorder, alignment: { vertical: "center" } });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resumo");
    XLSX.writeFile(wb, `telemetria_glp_${(base?.nome || "todas").replace(/\s/g, "_")}_${formatDate(new Date()).replace(/\//g, "-")}.xlsx`);
  }, [exportScope, base, city]);

  const topBarProps = { running, setRunning, speedSec, setSpeedSec, tick, globalTick, onExport: handleExport };

  return (
    <div style={{ background: COLORS.bg, color: COLORS.text, minHeight: "100%", fontFamily: "var(--font-body)", padding: "20px 16px 60px", overflowX: "hidden", boxSizing: "border-box" }}>
      <GlobalStyle />

      {view === "baseSelect" && (
        <BaseSelectScreen
          enrichedAll={enrichedAll}
          onPick={(id) => { setBaseId(id); setCity("all"); setStatusFilter(null); setView("dashboard"); }}
          liveProps={{ counts: globalCounts, total: enrichedAll.length, running, setRunning, speedSec, setSpeedSec, globalTick }}
          onOpenAlerts={() => setView("alerts")}
        />
      )}

      {view === "dashboard" && base && (
        <DashboardScreen
          base={base} city={city} setCity={(c) => { setCity(c); }}
          scopeClients={scopeClients} allBaseClients={baseClients}
          onIndicatorClick={(s) => { setStatusFilter(s); setView("list"); }}
          onSeeAll={() => { setStatusFilter(null); setView("list"); }}
          onDrillCity={(cid) => setCity(cid)}
          onBack={() => setView("baseSelect")}
          {...topBarProps}
        />
      )}

      {view === "list" && base && (
        <ListScreen
          base={base} city={city} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          list={listClients} onOpenClient={(id) => { setClientId(id); setReturnView("list"); setView("detail"); }}
          onBack={() => setView("dashboard")}
          {...topBarProps}
        />
      )}

      {view === "alerts" && (
        <AlertsScreen
          enrichedAll={enrichedAll}
          onOpenClient={(c) => { setBaseId(c.baseId); setCity(c.cidade); setStatusFilter(null); setClientId(c.id); setReturnView("alerts"); setView("detail"); }}
          onBack={() => setView("baseSelect")}
          {...topBarProps}
        />
      )}

      {view === "detail" && selectedClient && (
        <DetailScreen client={selectedClient} globalTick={globalTick} onBack={() => setView(returnView)} />
      )}
    </div>
  );
}
