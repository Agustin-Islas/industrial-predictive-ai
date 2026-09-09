"use client";

import React, { useMemo } from 'react';
import { Activity, Zap, AlertTriangle, Clock, BarChart2, Info, Play, Pause, RotateCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, YAxis as BarYAxis, XAxis as BarXAxis } from 'recharts';
import { useSimulation, AssetStatus } from './useSimulation';

const InfoTooltip = ({ text }: { text: string }) => (
  <div className="group relative ml-2 flex items-center">
    <Info className="w-4 h-4 text-slate-500 hover:text-cyan-400 cursor-help transition-colors" />
    <div className="absolute hidden group-hover:block w-64 p-3 bg-slate-900 text-xs text-slate-200 border border-slate-700 rounded-lg shadow-2xl z-[100] top-full left-0 mt-2 leading-relaxed font-normal normal-case">
      {text}
    </div>
  </div>
);

export default function Dashboard() {
  const { systemStatus, assets, isPlaying, setIsPlaying, resetSimulation } = useSimulation();
  const [selectedAssetId, setSelectedAssetId] = React.useState<string>('MTR-001');

  // --- Derived State for UI ---
  const assetsList = Object.values(assets);
  
  const sortedAssets = useMemo(() => {
    const weight = { CRITICAL: 4, WARNING: 3, WATCH: 2, NORMAL: 1 };
    return [...assetsList].sort((a, b) => {
      if (weight[b.status] !== weight[a.status]) {
        return weight[b.status] - weight[a.status];
      }
      return a.id.localeCompare(b.id);
    });
  }, [assetsList]);

  const selectedAsset = assets[selectedAssetId] || assetsList[0];
  const totalAlerts = assetsList.filter(a => a.status === 'CRITICAL' || a.status === 'WARNING').length;

  // --- Render Helpers ---
  const getStatusColor = (status: AssetStatus) => {
    switch(status) {
      case 'CRITICAL': return 'var(--status-critical)';
      case 'WARNING': return 'var(--status-warning)';
      case 'WATCH': return 'var(--status-watch)';
      default: return 'var(--status-normal)';
    }
  };

  const FEATURE_NAMES: Record<string, string> = {
    'Air temperature K': 'Temp. Aire',
    'Process temperature K': 'Temp. Proceso',
    'Rotational speed rpm': 'Velocidad (RPM)',
    'Torque Nm': 'Torque (Nm)',
    'Tool wear min': 'Desgaste Herr.',
    'delta_temp': 'Diferencial Temp.',
    'power_kw': 'Potencia (kW)',
    'wear_torque': 'Fuerza Desgaste',
    'air_temperature': 'Temp. Aire',
    'process_temperature': 'Temp. Proceso',
    'rotational_speed': 'Velocidad (RPM)',
    'torque': 'Torque (Nm)',
    'tool_wear': 'Desgaste Herr.'
  };

  const FIXED_ORDER = [
    'Temp. Proceso',
    'Temp. Aire',
    'Diferencial Temp.',
    'Velocidad (RPM)',
    'Torque (Nm)',
    'Potencia (kW)',
    'Desgaste Herr.',
    'Fuerza Desgaste'
  ].reverse();

  const shapData = useMemo(() => {
    if (!selectedAsset?.prediction?.classification?.shap_explanation) return [];
    
    const exp = selectedAsset.prediction.classification.shap_explanation;
    const totalAbs = Object.values(exp).reduce((sum: any, val: any) => sum + Math.abs(Number(val)), 0) || 1;

    const dataMap = new Map();
    Object.entries(exp).forEach(([name, value]) => {
      const translatedName = FEATURE_NAMES[name] || name;
      const absValue = Math.abs(Number(value));
      dataMap.set(translatedName, {
        name: translatedName,
        impact: (absValue / Number(totalAbs)) * 100,
        rawSign: Math.sign(Number(value))
      });
    });

    return FIXED_ORDER.map(name => {
      return dataMap.get(name) || { name, impact: 0, rawSign: 1 };
    });
  }, [selectedAsset?.prediction]);

  const Gauge = ({ value, min, max, label, unit, color, tooltipInfo }: any) => {
    const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    return (
      <div className="flex flex-col items-center justify-center p-2 group relative">
        {tooltipInfo && (
           <div className="absolute hidden group-hover:block w-48 p-2 bg-slate-900 text-[10px] text-slate-300 border border-slate-700 rounded shadow-lg z-[100] top-full left-1/2 transform -translate-x-1/2 mt-1 leading-tight font-normal normal-case text-center">
             {tooltipInfo}
           </div>
        )}
        <div className="relative w-20 h-20 md:w-28 md:h-28 mb-1">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="transparent" stroke="rgba(148, 163, 184, 0.1)" strokeWidth="6" />
            <circle 
              cx="50" cy="50" r="42" fill="transparent" stroke={color} strokeWidth="6"
              strokeDasharray={`${(percentage * 263.89) / 100} 263.89`}
              style={{ transition: 'stroke-dasharray 0.5s ease-in-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base md:text-xl font-bold tracking-tight" style={{ color }}>{value.toFixed(1)}</span>
            <span className="text-[9px] md:text-[10px] text-slate-400 mt-0.5">{unit}</span>
          </div>
        </div>
        <span className="text-[9px] md:text-[10px] text-slate-400 uppercase tracking-wider font-semibold text-center leading-tight">{label}</span>
      </div>
    );
  };

  const AnomalyMeter = ({ score, threshold }: any) => {
    const maxScore = threshold * 3;
    const percentage = Math.min(100, (score / maxScore) * 100);
    
    let color = 'var(--status-normal)';
    let statusText = 'NORMAL';
    if (score >= threshold * 2) { color = 'var(--status-critical)'; statusText = 'CRÍTICO'; } 
    else if (score >= threshold) { color = 'var(--status-warning)'; statusText = 'ADVERTENCIA'; } 
    else if (score >= threshold * 0.5) { color = 'var(--status-watch)'; statusText = 'OBSERVACIÓN'; }

    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="relative w-40 h-20 overflow-hidden mb-2">
          <div className="absolute top-0 left-0 w-full h-full rounded-t-full border-[10px] border-slate-800 border-b-0"></div>
          <div className="absolute top-0 left-0 w-full h-full rounded-t-full border-[10px] border-b-0 opacity-80" 
               style={{ borderColor: color, clipPath: `polygon(0 100%, 100% 100%, 100% ${100-percentage}%, 0 ${100-percentage}%)`, transition: 'all 0.5s ease' }}>
          </div>
          <div className="absolute bottom-0 left-1/2 w-1 h-16 bg-slate-200 origin-bottom rounded-t-full"
            style={{ transform: `translateX(-50%) rotate(${Math.min(180, percentage * 1.8) - 90}deg)`, transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-white rounded-full transform -translate-x-1/2 translate-y-1/2"></div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold mb-1" style={{ color }}>{score.toFixed(3)}</div>
          <div className="text-[10px] font-semibold tracking-wider uppercase" style={{ color }}>{statusText}</div>
          <div className="text-[10px] text-slate-500 mt-1">Umbral: {threshold.toFixed(3)}</div>
        </div>
      </div>
    );
  };

  if (!selectedAsset) return <div className="text-white p-10">Cargando Plataforma...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] h-screen w-screen overflow-hidden bg-slate-950">
      {/* Master List (Sidebar) */}
      <aside className="sidebar overflow-y-auto h-[35vh] md:h-full border-b md:border-b-0 md:border-r border-slate-800 flex flex-col z-10 bg-slate-900/95 shadow-xl">
        <div className="px-6 py-6 mb-2 flex items-center justify-between border-b border-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-cyan-500/20 flex items-center justify-center border border-cyan-500/50">
              <Zap className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="font-bold text-lg tracking-wide text-slate-100">INDUSTRIAL PREDICTIVE AI</span>
          </div>
        </div>
        
        <div className="px-4 mb-4 mt-2 flex justify-between items-center flex-shrink-0">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Activos</h3>
            <p className="text-[10px] text-slate-400">Orden de criticidad</p>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title={isPlaying ? "Pausar Simulación" : "Reanudar Simulación"}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-green-400" />}
            </button>
            <button 
              onClick={resetSimulation} 
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Reiniciar a Estado Normal"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 px-3 pb-6 flex-1 overflow-y-auto">
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
                <span className="font-bold text-slate-200 text-sm">{asset.id}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider"
                  style={{ 
                    color: getStatusColor(asset.status), 
                    backgroundColor: `${getStatusColor(asset.status)}20`,
                    border: `1px solid ${getStatusColor(asset.status)}40`
                  }}>
                  {asset.status === 'CRITICAL' ? 'CRÍTICO' : asset.status === 'WARNING' ? 'ADVERTENCIA' : asset.status === 'WATCH' ? 'OBSERVACIÓN' : 'NORMAL'}
                </span>
              </div>
              <div className="text-xs text-slate-400 mb-2 truncate">{asset.name}</div>
              
              <div className="flex justify-between items-center text-[10px] text-slate-500">
                {asset.type === 'TURBINE' ? (
                  <>
                    <span>RUL: <span className="font-mono text-slate-300">
                      {asset.rulHistory.length > 0 ? asset.rulHistory[asset.rulHistory.length-1].rul.toFixed(0) : '--'}c
                    </span></span>
                    <span>T41: <span className="font-mono text-slate-300">
                      {asset.sensorData?.s4?.toFixed(0) || '--'}°R
                    </span></span>
                  </>
                ) : (
                  <>
                    <span>Temp: <span className="font-mono text-slate-300">
                      {asset.sensorData?.process_temperature?.toFixed(0) || '--'}K
                    </span></span>
                    <span>RPM: <span className="font-mono text-slate-300">
                      {asset.sensorData?.rotational_speed?.toFixed(0) || '--'}
                    </span></span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Detail View (Main Content) */}
      <main className="main-content flex-1 flex flex-col overflow-y-auto p-4 md:p-6 gap-4">
        <header className="top-bar flex-shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 uppercase tracking-wide">Plataforma de Mantenimiento Predictivo</h1>
            <p className="text-sm text-slate-400 mt-1">Activo Seleccionado: <span className="text-cyan-400 font-semibold">{selectedAsset.name} ({selectedAsset.id})</span></p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Sistema:</span>
              <span className={`text-[10px] px-2 py-1 rounded bg-${systemStatus === 'CONNECTED' ? 'green' : 'cyan'}-500/20 text-${systemStatus === 'CONNECTED' ? 'green' : 'cyan'}-400 border border-${systemStatus === 'CONNECTED' ? 'green' : 'cyan'}-500/30 font-semibold tracking-wider`}>
                {systemStatus === 'CONNECTED' ? 'CONECTADO' : systemStatus === 'CONNECTING...' ? 'CONECTANDO...' : 'DESCONECTADO'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Alertas:</span>
              <span className={`text-[10px] px-2 py-1 rounded ${totalAlerts > 0 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-800 text-slate-300'} font-semibold`}>
                {totalAlerts.toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </header>

        <div className={`panels-grid flex-1 grid gap-4 min-h-0 ${selectedAsset.type === 'TURBINE' ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2'}`}>
          
          {selectedAsset.type === 'MOTOR' && (
            <>
              {/* Panel 1: Real-time Sensors (MOTOR) */}
              <div className="glass-card flex flex-col p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <h2 className="card-title text-sm"><Activity className="w-4 h-4 mr-2" /> Telemetría & Diagnóstico</h2>
                    <InfoTooltip text="Muestra los sensores en tiempo real. En la base, el modelo XGBoost (Clasificación Multiclase) diagnostica si los valores actuales se corresponden con alguna falla conocida (Ej: TWF, HDF, PWF)." />
                  </div>
                </div>
                
                <div className="flex justify-around items-center px-0 md:px-2 flex-1 flex-wrap">
                  <Gauge value={selectedAsset.sensorData?.process_temperature || 0} min={290} max={330} label="Temperatura" unit="°K" color="var(--accent-cyan)" tooltipInfo="Temperatura de operación. Picos repentinos están asociados a falla por sobrecalentamiento (HDF)." />
                  <Gauge value={selectedAsset.sensorData?.rotational_speed || 0} min={1200} max={2900} label="Velocidad" unit="RPM" color="var(--accent-green)" tooltipInfo="Revoluciones por minuto. Las caídas bruscas indican fallas de potencia (PWF)." />
                  <Gauge value={selectedAsset.sensorData?.torque || 0} min={10} max={80} label="Torque" unit="Nm" color="var(--accent-orange)" tooltipInfo="Fuerza de torsión. Valores muy altos sugieren sobrecarga o daño físico inminente." />
                </div>
                
                {selectedAsset.prediction?.classification && (
                  <div className="mt-2 p-2 bg-slate-800/50 rounded border border-slate-700/50 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">Estado Actual:</span>
                    <span className={`text-xs font-bold uppercase tracking-wide ${selectedAsset.prediction.classification.predicted_class === 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {selectedAsset.prediction.classification.predicted_label}
                    </span>
                  </div>
                )}
              </div>

              {/* Panel 2: SHAP Feature Importance */}
              <div className="glass-card flex flex-col p-4 xl:row-span-2 min-h-[350px]">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <h2 className="card-title text-sm"><BarChart2 className="w-4 h-4 mr-2" /> Impacto de Variables</h2>
                    <InfoTooltip text="Utiliza el algoritmo TreeSHAP (SHapley Additive exPlanations) para desglosar la decisión del XGBoost. Muestra qué porcentaje de 'culpa' tiene cada sensor en el diagnóstico actual. Celeste = Empuja a la decisión actual. Naranja = Contradice." />
                  </div>
                </div>
                
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={shapData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" horizontal={false} />
                      <BarXAxis type="number" stroke="#94a3b8" fontSize={10} domain={[0, 100]} tickFormatter={(val) => `${val.toFixed(0)}%`} />
                      <BarYAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={130} tick={{ fill: '#e2e8f0', fontWeight: 500 }} />
                      <Tooltip 
                        formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Impacto Relativo']}
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(0, 240, 255, 0.3)', borderRadius: '8px', fontSize: '11px' }}
                        itemStyle={{ color: '#00f0ff' }}
                      />
                      <Bar dataKey="impact" radius={[0, 4, 4, 0]} barSize={10} isAnimationActive={true}>
                        {shapData.map((entry, index) => (
                          <Cell key={`cell-${entry.name}`} fill={entry.rawSign > 0 ? 'var(--accent-cyan)' : 'var(--accent-orange)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Panel 3: Anomaly Detection */}
              <div className="glass-card flex flex-col p-4 min-h-[250px]">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <h2 className="card-title text-sm"><AlertTriangle className="w-4 h-4 mr-2" /> Detección de Anomalías</h2>
                    <InfoTooltip text="Modelo Autoencoder Neuronal (No Supervisado) entrenado solo con datos normales. Si ocurre una falla o comportamiento NUNCA antes visto por el XGBoost, el error de reconstrucción (MSE) explotará, disparando alertas preventivas." />
                  </div>
                </div>
                
                <div className="flex-1 flex items-center justify-center min-h-0 pt-4">
                  {selectedAsset.prediction?.anomaly ? (
                    <AnomalyMeter score={selectedAsset.prediction.anomaly.reconstruction_error} threshold={selectedAsset.prediction.anomaly.threshold} />
                  ) : (
                    <div className="text-slate-500 text-sm">Esperando datos...</div>
                  )}
                </div>
              </div>
            </>
          )}

          {selectedAsset.type === 'TURBINE' && (
            <>
              {/* Panel 1: Real-time Sensors (TURBINE CMAPSS) */}
              <div className="glass-card flex flex-col p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <h2 className="card-title text-sm"><Activity className="w-4 h-4 mr-2" /> Telemetría Termodinámica (CMAPSS)</h2>
                    <InfoTooltip text="Muestra sensores termodinámicos clave del motor a reacción (turbina)." />
                  </div>
                </div>
                
                <div className="flex justify-around items-center px-0 md:px-2 flex-1 flex-wrap">
                  <Gauge value={selectedAsset.sensorData?.s2 || 0} min={640} max={644} label="T24" unit="°R" color="var(--accent-cyan)" tooltipInfo="Temp. total a la salida del compresor de baja presión (LPC)." />
                  <Gauge value={selectedAsset.sensorData?.s4 || 0} min={1390} max={1430} label="T41" unit="°R" color="var(--accent-orange)" tooltipInfo="Temp. total en el quemador. Un aumento constante indica degradación grave de la turbina." />
                  <Gauge value={selectedAsset.sensorData?.s11 || 0} min={46} max={48} label="Ps30" unit="psia" color="var(--accent-green)" tooltipInfo="Presión estática a la salida del compresor de alta presión (HPC)." />
                  <Gauge value={selectedAsset.sensorData?.s15 || 0} min={8.3} max={8.5} label="BPR" unit="ratio" color="#a855f7" tooltipInfo="Bypass Ratio. Relación de flujo másico; su alteración sugiere desgaste interno." />
                </div>
              </div>

              {/* Panel 2: RUL Timeline */}
              <div className="glass-card flex flex-col p-4 min-h-[300px]">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <h2 className="card-title text-sm"><Clock className="w-4 h-4 mr-2" /> Vida Útil Restante (RUL)</h2>
                    <InfoTooltip text="Red Neuronal LSTM (Long Short-Term Memory) que analiza series temporales secuenciales (Ciclos) para pronosticar cuántos ciclos de vida útil le quedan al equipo antes del fallo final." />
                  </div>
                </div>
                
                <div className="flex-1 w-full min-h-0">
                  {selectedAsset.rulHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedAsset.rulHistory} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                        <XAxis dataKey="cycle" stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `Ciclo ${val}`} />
                        <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 150]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(0, 255, 136, 0.3)', borderRadius: '8px', fontSize: '11px' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="rul" 
                          stroke="var(--accent-green)" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: 'var(--accent-green)', stroke: 'white', strokeWidth: 2 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">Esperando ciclos...</div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
