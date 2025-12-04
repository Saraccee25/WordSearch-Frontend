import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [ws, setWs] = useState(null);
  const [juegoActivo, setJuegoActivo] = useState(false);
  const [juegoDatos, setJuegoDatos] = useState(null);
  const [tiempoInicio, setTiempoInicio] = useState(null);
  const [tiempo, setTiempo] = useState('00:00');
  const [palabrasEncontradas, setPalabrasEncontradas] = useState([]);
  const [posicionesEncontradas, setPosicionesEncontradas] = useState([]);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '', visible: false });
  
  const [seleccionando, setSeleccionando] = useState(false);
  const [celdaInicio, setCeldaInicio] = useState(null);
  const [celdasSeleccionadas, setCeldasSeleccionadas] = useState([]);
  
  const timerIntervalRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    conectarWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (tiempoInicio) {
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - tiempoInicio) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        setTiempo(`${mins}:${secs}`);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [tiempoInicio]);

  const conectarWebSocket = () => {
    const websocket = new WebSocket('ws://localhost:5000');
    
    websocket.onopen = () => {
      console.log('✓ Conectado al servidor');
      mostrarEstado('Conectado al servidor', 'success');
    };
    
    websocket.onmessage = (event) => {
      const datos = JSON.parse(event.data);
      console.log('Datos recibidos:', datos);
      procesarRespuesta(datos);
    };
    
    websocket.onerror = (error) => {
      console.error('Error WebSocket:', error);
      mostrarEstado('Error de conexión', 'error');
    };
    
    websocket.onclose = () => {
      console.log('Desconectado del servidor');
      mostrarEstado('Desconectado del servidor', 'error');
    };
    
    wsRef.current = websocket;
    setWs(websocket);
  };

  const iniciarJuego = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      conectarWebSocket();
      setTimeout(() => {
        enviarComando('START');
      }, 500);
    } else {
      enviarComando('START');
    }
  };

  const enviarComando = (comando, datos = {}) => {
    const mensaje = JSON.stringify({ comando, ...datos });
    wsRef.current.send(mensaje);
  };

  const procesarRespuesta = (datos) => {
    if (datos.error) {
      mostrarEstado(datos.error, 'error');
      return;
    }

    if (datos.tablero && datos.palabras) {
      setJuegoDatos(datos);
      setPalabrasEncontradas([]);
      setPosicionesEncontradas([]);
      setTiempoInicio(Date.now());
      setJuegoActivo(true);
      mostrarEstado(`¡Juego iniciado! Encuentra ${datos.total_palabras} palabras`, 'success');
    }

    if (datos.soluciones) {
      console.log('='.repeat(60));
      console.log('📦 DATOS DE SOLUCIÓN RECIBIDOS:');
      console.log('='.repeat(60));
      console.log('Total soluciones:', datos.soluciones.length);
      console.log('Mensaje:', datos.mensaje);
      console.log('Palabras faltantes:', datos.palabras_faltantes);
      console.log('Soluciones completas:', JSON.stringify(datos.soluciones, null, 2));
      console.log('='.repeat(60));
      
     
      setJuegoDatos(prev => ({
        ...prev,
        soluciones: datos.soluciones
      }));
      
      
      const todasLasPalabras = datos.soluciones.map(sol => sol.palabra);
      setPalabrasEncontradas(todasLasPalabras);
      
     
      const todasLasPosiciones = datos.soluciones.flatMap(sol => 
        sol.posiciones.map(pos => ({ fila: pos[0], col: pos[1] }))
      );
      setPosicionesEncontradas(todasLasPosiciones);
      
      setTiempoInicio(null);
      setJuegoActivo(false);
      
      const mensajeTexto = datos.palabras_faltantes && datos.palabras_faltantes.length > 0
        ? `⚠️ Solución parcial: ${datos.soluciones.length}/${datos.total_palabras + datos.palabras_faltantes.length} palabras`
        : '✓ Solución completa mostrada';
        
      mostrarEstado(mensajeTexto, 'info');
    }

    if (datos.palabras_encontradas !== undefined) {
      setPalabrasEncontradas(datos.palabras_encontradas);
      
      if (datos.completado) {
        mostrarEstado('🎉 ¡Felicidades! Has encontrado todas las palabras', 'success');
        setTiempoInicio(null);
        setJuegoActivo(false);
      }
    }
  };

  const iniciarSeleccion = (e, fila, col) => {
    if (!juegoActivo) return;
    
    setSeleccionando(true);
    setCeldaInicio({ fila, col, element: e.currentTarget });
    setCeldasSeleccionadas([{ fila, col }]);
  };

  const continuarSeleccion = (fila, col) => {
    if (!seleccionando || !juegoActivo || !celdaInicio) return;
    
    const filaInicio = celdaInicio.fila;
    const colInicio = celdaInicio.col;
    
    const deltaFila = fila - filaInicio;
    const deltaCol = col - colInicio;
    
    const esHorizontal = deltaFila === 0 && deltaCol !== 0;
    const esVertical = deltaCol === 0 && deltaFila !== 0;
    const esDiagonal = Math.abs(deltaFila) === Math.abs(deltaCol) && deltaFila !== 0;
    
    if (esHorizontal || esVertical || esDiagonal) {
      const pasos = Math.max(Math.abs(deltaFila), Math.abs(deltaCol));
      const dirFila = deltaFila === 0 ? 0 : deltaFila / Math.abs(deltaFila);
      const dirCol = deltaCol === 0 ? 0 : deltaCol / Math.abs(deltaCol);
      
      const nuevaSeleccion = [];
      for (let i = 0; i <= pasos; i++) {
        const f = filaInicio + dirFila * i;
        const c = colInicio + dirCol * i;
        nuevaSeleccion.push({ fila: f, col: c });
      }
      setCeldasSeleccionadas(nuevaSeleccion);
    }
  };

  const finalizarSeleccion = () => {
    if (!seleccionando || !juegoActivo || !juegoDatos) return;
    
    setSeleccionando(false);
    
    const palabraSeleccionada = celdasSeleccionadas
      .map(({ fila, col }) => juegoDatos.tablero[fila][col])
      .join('');
    
    if (juegoDatos.palabras.includes(palabraSeleccionada)) {
      if (!palabrasEncontradas.includes(palabraSeleccionada)) {
        
        const nuevasPosiciones = [...posicionesEncontradas, ...celdasSeleccionadas];
        setPosicionesEncontradas(nuevasPosiciones);
        
        enviarComando('ENCONTRAR', { palabra: palabraSeleccionada });
        mostrarEstado(`¡Encontraste: ${palabraSeleccionada}!`, 'success');
      } else {
        mostrarEstado('Ya encontraste esa palabra', 'info');
      }
    }
    
    setCeldasSeleccionadas([]);
    setCeldaInicio(null);
  };

  useEffect(() => {
    const handleMouseUp = () => {
      if (seleccionando) {
        finalizarSeleccion();
      }
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [seleccionando, celdasSeleccionadas, juegoActivo, juegoDatos, palabrasEncontradas]);

  const resolverJuego = () => {
    if (!juegoActivo) return;
    enviarComando('RESOLVER');
  };

  const mostrarEstado = (texto, tipo = '') => {
    setMensaje({ texto, tipo, visible: true });
    setTimeout(() => {
      setMensaje(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  const getCeldaClase = (fila, col) => {
    let clases = 'cell';
    

    const yaEncontrada = posicionesEncontradas.some(
      pos => pos.fila === fila && pos.col === col
    );
    
    if (yaEncontrada) {
      clases += ' found';
      return clases;
    }
    
    
    if (juegoDatos?.soluciones) {
      const esSolucion = juegoDatos.soluciones.some(sol =>
        sol.posiciones.some(pos => pos[0] === fila && pos[1] === col)
      );
      if (esSolucion) {
        clases += ' found';
        return clases;
      }
    }
    
  
    if (celdasSeleccionadas.some(c => c.fila === fila && c.col === col)) {
      clases += ' selecting';
    }
    
    return clases;
  };

  const getPorcentaje = () => {
    if (!juegoDatos) return 0;
    return Math.round((palabrasEncontradas.length / juegoDatos.total_palabras) * 100);
  };

  return (
    <div className="container">
      <h1>🔍 Sopa de Letras</h1>
      <p className="subtitle">Encuentra todas las profesiones escondidas</p>

      <div className="controls">
        <div className="timer">⏱️ <span>{tiempo}</span></div>
        <div className="buttons">
          <button className="btn-primary" onClick={iniciarJuego}>
            Nuevo Juego
          </button>
          <button 
            className="btn-warning" 
            onClick={resolverJuego}
            disabled={!juegoActivo}
          >
            Ver Solución
          </button>
        </div>
      </div>

      <div className="progress">
        <div className="progress-bar" style={{ width: `${getPorcentaje()}%` }}>
          {juegoDatos ? `${palabrasEncontradas.length}/${juegoDatos.total_palabras} - ${getPorcentaje()}%` : '0%'}
        </div>
      </div>

      {mensaje.visible && (
        <div className={`status ${mensaje.tipo}`}>
          {mensaje.texto}
        </div>
      )}

      <div className="game-area">
        <div className="board-container">
          {juegoDatos ? (
            <div 
              className="board"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${juegoDatos.tablero.length}, 35px)`,
                gap: '3px',
                justifyContent: 'center',
                userSelect: 'none'
              }}
            >
              {juegoDatos.tablero.map((fila, i) =>
                fila.map((letra, j) => (
                  <div
                    key={`${i}-${j}`}
                    className={getCeldaClase(i, j)}
                    onMouseDown={(e) => iniciarSeleccion(e, i, j)}
                    onMouseEnter={() => continuarSeleccion(i, j)}
                  >
                    {letra}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="loading">
              Presiona "Nuevo Juego" para comenzar
            </div>
          )}
        </div>

        <div className="words-panel">
          <h3>📋 Palabras a Encontrar</h3>
          <ul className="word-list">
            {juegoDatos ? (
              juegoDatos.palabras.map((palabra) => (
                <li
                  key={palabra}
                  className={`word-item ${palabrasEncontradas.includes(palabra) ? 'found' : ''}`}
                >
                  {palabra}
                </li>
              ))
            ) : (
              <li className="word-item">Esperando juego...</li>
            )}
          </ul>
        </div>
      </div>

      <div className="instructions">
        <h4>📖 Instrucciones:</h4>
        <ul>
          <li><strong>Seleccionar palabra:</strong> Haz clic en la primera letra y arrastra hasta la última</li>
          <li><strong>Direcciones válidas:</strong> Horizontal, vertical y diagonales</li>
          <li><strong>Ver solución:</strong> Click en "Ver Solución" para resolver automáticamente</li>
        </ul>
      </div>
    </div>
  );
}

export default App;