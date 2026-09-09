import { useState, useEffect, useRef } from 'react';

export type AssetType = 'MOTOR' | 'TURBINE';
export type AssetStatus = 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL';

export interface AssetData {
  id: string;
  name: string;
  type: AssetType;
  sensorData: any; // Mantiene el state actual de sensores para el UI
  prediction: any | null; // Guardará { classification, anomaly } o { rul }
  rulHistory: { cycle: number; rul: number }[];
  status: AssetStatus;
  ws: WebSocket | null;
  anomalyType: string;
  anomalyProgress: number;
  sequenceBuffer?: number[][]; // Para almacenar la serie temporal de 30x12 de las turbinas
}

const INITIAL_ASSETS: Partial<AssetData>[] = [
  { id: 'MTR-001', name: 'Bomba Principal A', type: 'MOTOR', anomalyType: 'NONE' },
  { id: 'MTR-002', name: 'Compresor Gas B', type: 'MOTOR', anomalyType: 'HEAT' },
  { id: 'MTR-003', name: 'Ventilador Torre', type: 'MOTOR', anomalyType: 'WEAR' },
  { id: 'TRB-001', name: 'Turbina de Compresión', type: 'TURBINE', anomalyType: 'DEGRADE' },
  { id: 'TRB-002', name: 'Turbina a Gas', type: 'TURBINE', anomalyType: 'NONE' },
];

export function useSimulation() {
  const [systemStatus, setSystemStatus] = useState('CONNECTING...');
  const [assets, setAssets] = useState<Record<string, AssetData>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const initAssetData = (config: any): AssetData => {
    let initialSensorData = {};
    let sequenceBuffer: number[][] = [];
    
    if (config.type === 'MOTOR') {
      initialSensorData = {
        air_temperature: 298,
        process_temperature: 308,
        rotational_speed: 1500,
        torque: 40,
        tool_wear: 0
      };
    } else {
      // CMAPSS sensors (approximate baseline for the 12 useful sensors)
      initialSensorData = {
        s2: 642.0, s3: 1589.0, s4: 1406.0, s7: 554.0, 
        s8: 2388.0, s9: 9044.0, s11: 47.0, s12: 521.0, 
        s13: 2388.0, s14: 8138.0, s15: 8.4, s21: 39.0
      };
      // Fill initial buffer with baseline
      const baseline = Object.values(initialSensorData);
      sequenceBuffer = Array(30).fill(baseline);
    }

    return {
      id: config.id,
      name: config.name,
      type: config.type,
      sensorData: initialSensorData,
      prediction: null,
      rulHistory: [],
      status: 'NORMAL',
      ws: null,
      anomalyType: config.anomalyType,
      anomalyProgress: 0,
      sequenceBuffer: sequenceBuffer.length > 0 ? sequenceBuffer : undefined
    };
  };

  const resetSimulation = () => {
    setAssets(prev => {
      const reset = { ...prev };
      INITIAL_ASSETS.forEach(config => {
        if (reset[config.id!]) {
          const defaults = initAssetData(config);
          reset[config.id!] = {
            ...reset[config.id!],
            sensorData: defaults.sensorData,
            rulHistory: [],
            status: 'NORMAL',
            anomalyProgress: 0,
            prediction: null,
            sequenceBuffer: defaults.sequenceBuffer
          };
        }
      });
      return reset;
    });
  };

  useEffect(() => {
    const newAssets: Record<string, AssetData> = {};
    const sockets: WebSocket[] = [];

    INITIAL_ASSETS.forEach((config) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/stream';
      const ws = new WebSocket(wsUrl);
      sockets.push(ws);

      const asset = initAssetData(config);
      asset.ws = ws;
      newAssets[asset.id] = asset;

      ws.onopen = () => setSystemStatus('CONNECTED');
      ws.onclose = () => setSystemStatus('OFFLINE');

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        setAssets(prev => {
          if (!prev[asset.id]) return prev;
          
          let newStatus: AssetStatus = 'NORMAL';
          const prevAsset = prev[asset.id];
          let updatedRulHistory = prevAsset.rulHistory;

          if (data.asset_type === 'MOTOR' && data.anomaly && data.classification) {
            if (data.anomaly.severity === 'critical' || data.classification.predicted_class !== 0) {
              newStatus = 'CRITICAL';
            } else if (data.anomaly.severity === 'warning') {
              newStatus = 'WARNING';
            } else if (data.anomaly.severity === 'watch') {
              newStatus = 'WATCH';
            }
          } else if (data.asset_type === 'TURBINE' && data.rul) {
            const risk = data.rul.risk_level;
            if (risk === 'critical') newStatus = 'CRITICAL';
            else if (risk === 'high') newStatus = 'WARNING';
            else if (risk === 'medium') newStatus = 'WATCH';
            
            // Appending RUL to history for the chart
            const nextCycle = updatedRulHistory.length > 0 ? updatedRulHistory[updatedRulHistory.length - 1].cycle + 1 : 1;
            updatedRulHistory = [...updatedRulHistory, { cycle: nextCycle, rul: data.rul.predicted_rul }];
            if (updatedRulHistory.length > 50) updatedRulHistory.shift(); // Keep last 50 points
          }

          return {
            ...prev,
            [asset.id]: {
              ...prevAsset,
              prediction: data,
              status: newStatus,
              rulHistory: updatedRulHistory
            }
          };
        });
      };
    });

    setAssets(newAssets);

    const interval = setInterval(() => {
      if (!isPlayingRef.current) return;

      setAssets(prev => {
        const next = { ...prev };
        
        Object.keys(next).forEach(id => {
          const asset = next[id];
          if (!asset.ws || asset.ws.readyState !== WebSocket.OPEN) return;

          let newProgress = asset.anomalyProgress;
          if (newProgress === 0 && Math.random() > 0.98 && asset.anomalyType !== 'NONE') {
            newProgress = 1;
          } else if (newProgress > 0) {
            newProgress += 1;
          }

          if (asset.type === 'MOTOR') {
            const newData = {
              air_temperature: 298 + (Math.random() * 0.4 - 0.2),
              process_temperature: 308 + (Math.random() * 0.4 - 0.2),
              rotational_speed: 1500 + (Math.random() * 20 - 10),
              torque: 40 + (Math.random() * 2 - 1),
              tool_wear: asset.sensorData.tool_wear + 0.1
            };

            if (newProgress > 0) {
              const intensity = Math.min(newProgress, 30);
              if (asset.anomalyType === 'HEAT') {
                newData.process_temperature += intensity * 0.6;
                newData.rotational_speed -= intensity * 2;
              } else if (asset.anomalyType === 'WEAR') {
                newData.tool_wear += intensity * 4;
                newData.torque += intensity * 0.8;
              } else if (asset.anomalyType === 'POWER') {
                newData.torque += intensity * 1.5;
                newData.rotational_speed -= intensity * 12;
              }
            }

            asset.ws.send(JSON.stringify({ asset_type: 'MOTOR', data: newData }));
            next[id] = { ...asset, sensorData: newData, anomalyProgress: newProgress };
            
          } else if (asset.type === 'TURBINE') {
            // Simulate CMAPSS sequence degradation
            const baseline = {
              s2: 642.0, s3: 1589.0, s4: 1406.0, s7: 554.0, 
              s8: 2388.0, s9: 9044.0, s11: 47.0, s12: 521.0, 
              s13: 2388.0, s14: 8138.0, s15: 8.4, s21: 39.0
            };
            
            const intensity = newProgress * 0.05; // Gradual degradation
            const newData = {
              s2: baseline.s2 + (Math.random() - 0.5) * 2 + intensity * 5,
              s3: baseline.s3 + (Math.random() - 0.5) * 5 + intensity * 15,
              s4: baseline.s4 + (Math.random() - 0.5) * 5 + intensity * 10,
              s7: baseline.s7 + (Math.random() - 0.5) * 2 - intensity * 5,
              s8: baseline.s8 + (Math.random() - 0.5) * 0.1,
              s9: baseline.s9 + (Math.random() - 0.5) * 10,
              s11: baseline.s11 + (Math.random() - 0.5) * 0.5 + intensity * 1.5,
              s12: baseline.s12 + (Math.random() - 0.5) * 2 - intensity * 4,
              s13: baseline.s13 + (Math.random() - 0.5) * 0.1,
              s14: baseline.s14 + (Math.random() - 0.5) * 10,
              s15: baseline.s15 + (Math.random() - 0.5) * 0.1 + intensity * 0.2,
              s21: baseline.s21 + (Math.random() - 0.5) * 0.5 - intensity * 0.5
            };

            const vector = Object.values(newData);
            const newBuffer = [...(asset.sequenceBuffer || []).slice(1), vector];
            
            asset.ws.send(JSON.stringify({ 
              asset_type: 'TURBINE', 
              data: { sequence: newBuffer } 
            }));

            next[id] = { ...asset, sensorData: newData, anomalyProgress: newProgress, sequenceBuffer: newBuffer };
          }
        });
        
        return next;
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      sockets.forEach(ws => ws.close());
    };
  }, []);

  return { systemStatus, assets, isPlaying, setIsPlaying, resetSimulation };
}
