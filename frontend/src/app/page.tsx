"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Thermometer, Zap, AlertTriangle, Clock, Settings, HardDrive, BarChart2, ShieldCheck, History, LogOut } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, YAxis as BarYAxis, XAxis as BarXAxis } from 'recharts';

// --- Types ---
type AssetStatus = 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL';

interface AssetData {
  id: string;
  name: string;
  sensorData: {
    air_temperature: number;
    process_temperature: number;
    rotational_speed: number;
    torque: number;
    tool_wear: number;
  };
  prediction: any | null;
  rulHistory: { cycle: number; rul: number }[];
  status: AssetStatus;
  ws: WebSocket | null;
}

// --- Initial Config ---
const INITIAL_ASSETS = [
  { id: 'MTR-001', name: 'Bomba Principal A', baseTemp: 298, baseRpm: 1550 },
  { id: 'MTR-002', name: 'Compresor Gas B', baseTemp: 302, baseRpm: 2100 },
  { id: 'MTR-003', name: 'Ventilador Torre', baseTemp: 295, baseRpm: 1200 },
  { id: 'MTR-004', name: 'Bomba Inyección', baseTemp: 305, baseRpm: 2800 },
  { id: 'MTR-005', name: 'Motor Auxiliar', baseTemp: 300, baseRpm: 1400 },
];

export default function Dashboard() {
  const [systemStatus, setSystemStatus] = useState('CONNECTING...');
  const [assets, setAssets] = useState<Record<string, AssetData>>({});
  const [selectedAssetId, setSelectedAssetId] = useState<string>(INITIAL_ASSETS[0].id);

  // Initialize Assets and WebSockets
  useEffect(() => {
    const newAssets: Record<string, AssetData> = {};
    const sockets: WebSocket[] = [];

    INITIAL_ASSETS.forEach((config) => {
      const ws = new WebSocket('ws://localhost:8000/ws/stream');
      sockets.push(ws);

      newAssets[config.id] = {
        id: config.id,
        name: config.name,
        sensorData: {
          air_temperature: config.baseTemp,
          process_temperature: config.baseTemp + 10,
          rotational_speed: config.baseRpm,
          torque: 40 + Math.random() * 20,
          tool_wear: Math.random() * 50
        },
        prediction: null,
        rulHistory: Array.from({length: 20}).map((_, i) => ({
          cycle: i,
          rul: 125 - (i * 0.5) + (Math.random() * 2 - 1)
        })),
        status: 'NORMAL',
        ws: ws
      };

      ws.onopen = () => setSystemStatus('CONNECTED');
      ws.onclose = () => setSystemStatus('OFFLINE');

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        setAssets(prev => {
          if (!prev[config.id]) return prev;
          
          let newStatus: AssetStatus = 'NORMAL';
          if (data.anomaly.severity === 'critical' || data.classification.predicted_class !== 0) {
            newStatus = 'CRITICAL';
          } else if (data.anomaly.severity === 'warning') {
            newStatus = 'WARNING';
          } else if (data.anomaly.severity === 'watch') {
            newStatus = 'WATCH';
          }

          return {
            ...prev,
            [config.id]: {
              ...prev[config.id],
              prediction: data,
              status: newStatus
            }
          };
        });
      };
    });

    setAssets(newAssets);

    // Simulation Loop
    const interval = setInterval(() => {
      setAssets(prev => {
        const next = { ...prev };
        
        Object.keys(next).forEach(id => {
          const asset = next[id];
          if (!asset.ws || asset.ws.readyState !== WebSocket.OPEN) return;

          // Generate next tick data
          const newData = {
            air_temperature: asset.sensorData.air_temperature + (Math.random() * 0.4 - 0.2),
            process_temperature: asset.sensorData.process_temperature + (Math.random() * 0.4 - 0.2),
            rotational_speed: asset.sensorData.rotational_speed + (Math.random() * 20 - 10),
            torque: asset.sensorData.torque + (Math.random() * 2 - 1),
            tool_wear: asset.sensorData.tool_wear + 0.1
          };

          // 2% chance to trigger an anomaly per tick per machine
          if (Math.random() > 0.98) {
             newData.process_temperature += 8;
             newData.rotational_speed -= 300;
          }

          // Send to backend
          asset.ws.send(JSON.stringify(newData));

          // Update local state
          const lastRul = asset.rulHistory[asset.rulHistory.length - 1];
          const nextCycle = lastRul.cycle + 1;
          const nextRulVal = Math.max(0, lastRul.rul - 0.1 + (Math.random() * 1 - 0.5));
          
          next[id] = {
            ...asset,
            sensorData: newData,
            rulHistory: [...asset.rulHistory.slice(1), { cycle: nextCycle, rul: nextRulVal }]
          };
        });
        
        return next;
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      sockets.forEach(ws => ws.close());
    };
  }, []);


  // --- Derived State for UI ---
  const assetsList = Object.values(assets);
  
  // Sort by severity (CRITICAL > WARNING > WATCH > NORMAL) then by ID
  const sortedAssets = useMemo(() => {
    const weight = { CRITICAL: 4, WARNING: 3, WATCH: 2, NORMAL: 1 };
    return [...assetsList].sort((a, b) => {
      if (weight[b.status] !== weight[a.status]) {
        return weight[b.status] - weight[a.status];
      }
      return a.id.localeCompare(b.id);
    });
  }, [assetsList]);

  const selectedAsset = assets[selectedAssetId];
  
  const totalAlerts = assetsList.filter(a => a.status === 'CRITICAL' || a.status === 'WARNING').length;

  // --- Render Helpers ---
  const getStatusColor = (status: AssetStatus) => {
    switch(status) {
      case 'CRITICAL': return 'var(--status-critical)'; // text-red-500
      case 'WARNING': return 'var(--status-warning)';   // text-orange-500
      case 'WATCH': return 'var(--status-watch)';       // text-yellow-500
      default: return 'var(--status-normal)';           // text-green-500
    }
  };

  const shapData = selectedAsset?.prediction ? 
    Object.entries(selectedAsset.prediction.classification.shap_explanation)
      .map(([name, value]) => ({ name: name.replace(' K', '').replace(' rpm', ''), value: Number(value) }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 6)
    : [];

  const Gauge = ({ value, min, max, label, unit, color }: any) => {
    const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    return (
      <div className="flex flex-col items-center justify-center p-4">
        <div className="relative w-24 h-24 mb-2">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(148, 163, 184, 0.1)" strokeWidth="8" />
            <circle 
              cx="50" cy="50" r="40" fill="transparent" stroke={color} strokeWidth="8"
              strokeDasharray={`${(percentage * 251.2) / 100} 251.2`}
              style={{ transition: 'stroke-dasharray 0.5s ease-in-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold" style={{ color }}>{value.toFixed(1)}</span>
            <span className="text-[10px] text-slate-400">{unit}</span>
          </div>
        </div>
        <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{label}</span>
      </div>
    );
  };

  const AnomalyMeter = ({ score, threshold }: any) => {
    const maxScore = threshold * 3;
    const percentage = Math.min(100, (score / maxScore) * 100);
    
    let color = 'var(--status-normal)';
    let statusText = 'NORMAL';
    if (score >= threshold * 2) { color = 'var(--status-critical)'; statusText = 'CRITICAL'; } 
    else if (score >= threshold) { color = 'var(--status-warning)'; statusText = 'WARNING'; } 
    else if (score >= threshold * 0.5) { color = 'var(--status-watch)'; statusText = 'WATCH'; }

    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="relative w-48 h-24 overflow-hidden mb-4">
          <div className="absolute top-0 left-0 w-full h-full rounded-t-full border-[12px] border-slate-800 border-b-0"></div>
          <div className="absolute top-0 left-0 w-full h-full rounded-t-full border-[12px] border-b-0 opacity-80" 
               style={{ borderColor: color, clipPath: `polygon(0 100%, 100% 100%, 100% ${100-percentage}%, 0 ${100-percentage}%)`, transition: 'all 0.5s ease' }}>
          </div>
          <div className="absolute bottom-0 left-1/2 w-1 h-20 bg-slate-200 origin-bottom rounded-t-full"
            style={{ transform: `translateX(-50%) rotate(${Math.min(180, percentage * 1.8) - 90}deg)`, transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-white rounded-full transform -translate-x-1/2 translate-y-1/2"></div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold mb-1" style={{ color }}>{score.toFixed(3)}</div>
          <div className="text-xs font-semibold tracking-wider uppercase" style={{ color }}>{statusText}</div>
          <div className="text-xs text-slate-500 mt-2">Threshold: {threshold.toFixed(3)}</div>
        </div>
      </div>
    );
  };

  if (!selectedAsset) return <div className="text-white p-10">Cargando...</div>;

  return (
    <div className="dashboard-container !grid-cols-[300px_1fr]">
      {/* Master List (Sidebar) */}
      <aside className="sidebar overflow-y-auto">
        <div className="px-6 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-cyan-500/20 flex items-center justify-center border border-cyan-500/50">
            <Zap className="w-5 h-5 text-cyan-400" />
          </div>
          <span className="font-bold text-lg tracking-wide text-slate-100">YPF PREDICT</span>
        </div>
        
        <div className="px-4 mb-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Lista de Activos</h3>
          <p className="text-xs text-slate-400 mb-4">Ordenados por criticidad en tiempo real.</p>
        </div>

        <div className="flex flex-col gap-2 px-3 flex-1">
          {sortedAssets.map(asset => (
            <button 
              key={asset.id}
              onClick={() => setSelectedAssetId(asset.id)}
              className={`flex flex-col p-3 rounded-lg border text-left transition-all ${
                selectedAssetId === asset.id 
                  ? 'bg-slate-800 border-cyan-500/50 shadow-[0_0_15px_rgba(0,240,255,0.1)]' 
                  : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800/80'
              }`}
            >
              <div className="flex justify-between items-center w-full mb-2">
                <span className="font-bold text-slate-200">{asset.id}</span>
                <span className="text-[10px] px-2 py-1 rounded font-bold tracking-wider"
                  style={{ 
                    color: getStatusColor(asset.status), 
                    backgroundColor: `${getStatusColor(asset.status)}20`,
                    border: `1px solid ${getStatusColor(asset.status)}40`
                  }}>
                  {asset.status}
                </span>
              </div>
              <div className="text-sm text-slate-400 mb-2">{asset.name}</div>
              
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>RUL: <span className="font-mono text-slate-300">
                  {asset.rulHistory[asset.rulHistory.length-1].rul.toFixed(0)}c
                </span></span>
                <span>Temp: <span className="font-mono text-slate-300">
                  {asset.sensorData.process_temperature.toFixed(0)}K
                </span></span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Detail View (Main Content) */}
      <main className="main-content h-screen overflow-y-auto">
        <header className="top-bar">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 uppercase tracking-wide">Plataforma de Mantenimiento Predictivo</h1>
            <p className="text-sm text-slate-400 mt-1">Activo Seleccionado: <span className="text-cyan-400 font-semibold">{selectedAsset.name} ({selectedAsset.id})</span></p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">System:</span>
              <span className={`text-xs px-2 py-1 rounded bg-${systemStatus === 'CONNECTED' ? 'green' : 'cyan'}-500/20 text-${systemStatus === 'CONNECTED' ? 'green' : 'cyan'}-400 border border-${systemStatus === 'CONNECTED' ? 'green' : 'cyan'}-500/30 font-semibold tracking-wider`}>
                {systemStatus}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Alerts:</span>
              <span className={`text-xs px-2 py-1 rounded ${totalAlerts > 0 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-800 text-slate-300'} font-semibold`}>
                {totalAlerts.toString().padStart(2, '0')}
              </span>
            </div>
            <div className="flex items-center gap-3 pl-6 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-slate-700"></div>
              <span className="text-sm font-medium">Operator 4</span>
            </div>
          </div>
        </header>

        <div className="panels-grid">
          {/* Panel 1: Real-time Sensors */}
          <div className="glass-card flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <h2 className="card-title"><Activity className="w-4 h-4" /> Telemetría (Sensores)</h2>
              <span className="text-xs px-2 py-1 bg-slate-800 rounded text-slate-300 border border-slate-700">En vivo</span>
            </div>
            
            <div className="flex justify-between items-center px-4 py-2 flex-1">
              <Gauge 
                value={selectedAsset.sensorData.process_temperature} 
                min={290} max={330} 
                label="Temperatura" unit="°K" 
                color="var(--accent-cyan)" 
              />
              <Gauge 
                value={selectedAsset.sensorData.rotational_speed} 
                min={1200} max={2900} 
                label="Velocidad" unit="RPM" 
                color="var(--accent-green)" 
              />
              <Gauge 
                value={selectedAsset.sensorData.torque} 
                min={10} max={80} 
                label="Torque" unit="Nm" 
                color="var(--accent-orange)" 
              />
            </div>
            
            {/* Classification Result */}
            {selectedAsset.prediction && (
              <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 flex justify-between items-center">
                <span className="text-sm text-slate-400">Diagnóstico XGBoost:</span>
                <span className={`font-bold uppercase tracking-wide ${selectedAsset.prediction.classification.predicted_class === 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {selectedAsset.prediction.classification.predicted_label}
                </span>
              </div>
            )}
          </div>

          {/* Panel 2: SHAP Feature Importance */}
          <div className="glass-card flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <h2 className="card-title"><BarChart2 className="w-4 h-4" /> Explicabilidad SHAP</h2>
              <span className="text-xs text-slate-500">¿Por qué falló?</span>
            </div>
            
            <div className="flex-1 w-full min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shapData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" horizontal={false} />
                  <BarXAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => val.toFixed(1)} />
                  <BarYAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={100} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(0, 240, 255, 0.3)', borderRadius: '8px' }}
                    itemStyle={{ color: '#00f0ff' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                    {shapData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.value > 0 ? 'var(--accent-cyan)' : 'var(--accent-orange)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Panel 3: Anomaly Detection */}
          <div className="glass-card flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <h2 className="card-title"><AlertTriangle className="w-4 h-4" /> Detección de Anomalías</h2>
              <span className="text-xs text-slate-500">Autoencoder</span>
            </div>
            
            <div className="flex-1 flex items-center justify-center min-h-[220px]">
              {selectedAsset.prediction ? (
                <AnomalyMeter score={selectedAsset.prediction.anomaly.reconstruction_error} threshold={selectedAsset.prediction.anomaly.threshold} />
              ) : (
                <div className="text-slate-500 text-sm">Waiting for data...</div>
              )}
            </div>
          </div>

          {/* Panel 4: RUL Timeline */}
          <div className="glass-card flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <h2 className="card-title"><Clock className="w-4 h-4" /> Vida Útil Restante (RUL)</h2>
              <span className="text-xs text-slate-500">Curva de Degradación LSTM</span>
            </div>
            
            <div className="flex-1 w-full min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedAsset.rulHistory} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                  <XAxis dataKey="cycle" stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `t+${val}`} />
                  <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 150]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(0, 255, 136, 0.3)', borderRadius: '8px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="rul" 
                    stroke="var(--accent-green)" 
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: 'var(--accent-green)', stroke: 'white', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
