import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [ws, setWs] = useState(null);
  const [juegoActivo, setJuegoActivo] = useState(false);
  const [juegoDatos, setJuegoDatos] = useState(null);
  const [tiempo, setTiempo] = useState('00:00');
  const [palabrasEncontradas, setPalabrasEncontradas] = useState([]);
  const [estado, setEstado] = useState({ mensaje: '', tipo: '', visible: false });
  
  const [seleccionando, setSeleccionando] = useState(false);
  const [celdaInicio, setCeldaInicio] = useState(null);
  const [celdasSeleccionadas, setCeldasSeleccionadas] = useState([]);
  const [celdasPalabrasEncontradas, setCeldasPalabrasEncontradas] = useState([]);
  const [celdasSolucion, setCeldasSolucion] = useState([]);
  const [mostrandoSolucion, setMostrandoSolucion] = useState(false);
  
  const timerIntervalRef = useRef(null);
  const tiempoInicioRef = useRef(null);
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
    wsRef.current = ws;
  }, [ws]);

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
    
    setWs(websocket);
  };

  const enviarComando = (comando, datos = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const mensaje = JSON.stringify({ comando, ...datos });
      wsRef.current.send(mensaje);
    }
  };

  const iniciarJuego = () => {
    // Reiniciar estado
    setMostrandoSolucion(false);
    setCeldasSolucion([]);
    setCeldasPalabrasEncontradas([]);
    setPalabrasEncontradas([]);
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      conectarWebSocket();
      setTimeout(() => {
        enviarComando('START');
      }, 500);
    } else {
      enviarComando('START');
    }
  };

  const procesarRespuesta = (datos) => {
    if (datos.error) {
      mostrarEstado(datos.error, 'error');
      return;
    }

    if (datos.tablero && datos.palabras) {
      setJuegoDatos(datos);
      setPalabrasEncontradas([]);
      setCeldasPalabrasEncontradas([]);
      setCeldasSolucion([]);
      setMostrandoSolucion(false);
      iniciarTimer();
      setJuegoActivo(true);
      mostrarEstado(`¡Juego iniciado! Encuentra ${datos.total_palabras} palabras`, 'success');
    }

    if (datos.soluciones) {
      console.log('='.repeat(60));
      console.log('📦 DATOS DE SOLUCIÓN RECIBIDOS:');
      console.log('='.repeat(60));
      console.log('Total soluciones:', datos.soluciones.length);
      console.log('Soluciones completas:', JSON.stringify(datos.soluciones, null, 2));
      console.log('='.repeat(60));
      
      // Marcar que estamos mostrando la solución
      setMostrandoSolucion(true);
      
      // Procesar soluciones y marcar celdas
      const celdasSol = [];
      datos.soluciones.forEach((solucion, index) => {
        console.log(`Palabra ${index + 1}: ${solucion.palabra}`, solucion.posiciones);
        
        solucion.posiciones.forEach(pos => {
          celdasSol.push(`${pos[0]}-${pos[1]}`);
        });
      });
      
      setCeldasSolucion(celdasSol);
      
      // Marcar TODAS las palabras como encontradas
      if (juegoDatos && juegoDatos.palabras) {
        console.log('🎯 Marcando TODAS las palabras como encontradas:', juegoDatos.palabras);
        setPalabrasEncontradas([...juegoDatos.palabras]);
      }
      
      // Detener el temporizador
      detenerTimer();
      
      // Desactivar el juego
      setJuegoActivo(false);
      
      const mensaje = datos.palabras_faltantes && datos.palabras_faltantes.length > 0
        ? `⚠️ Solución parcial: ${datos.soluciones.length}/${datos.total_palabras + datos.palabras_faltantes.length} palabras`
        : '✓ Solución completa mostrada';
        
      mostrarEstado(mensaje, 'info');
      
      console.log(`✓ Solución mostrada: ${datos.soluciones.length} palabras resaltadas`);
    }

    if (datos.palabras_encontradas !== undefined) {
      setPalabrasEncontradas(datos.palabras_encontradas);
      
      if (datos.completado) {
        mostrarEstado('🎉 ¡Felicidades! Has encontrado todas las palabras', 'success');
        detenerTimer();
        setJuegoActivo(false);
      }
    }
  };

  const iniciarTimer = () => {
    detenerTimer();
    tiempoInicioRef.current = Date.now();
    
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - tiempoInicioRef.current) / 1000);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      setTiempo(`${mins}:${secs}`);
    }, 1000);
  };

  const detenerTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const mostrarEstado = (mensaje, tipo = '') => {
    setEstado({ mensaje, tipo, visible: true });
    
    setTimeout(() => {
      setEstado(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  const resolverJuego = () => {
    if (!juegoActivo) return;
    enviarComando('RESOLVER');
  };

  const iniciarSeleccion = (e, fila, col) => {
    if (!juegoActivo || mostrandoSolucion) return;
    
    setSeleccionando(true);
    setCeldaInicio({ fila, col });
    setCeldasSeleccionadas([{ fila, col }]);
  };

  const continuarSeleccion = (fila, col) => {
    if (!seleccionando || !juegoActivo || !celdaInicio || mostrandoSolucion) return;
    
    const deltaFila = fila - celdaInicio.fila;
    const deltaCol = col - celdaInicio.col;
    
    const esHorizontal = deltaFila === 0 && deltaCol !== 0;
    const esVertical = deltaCol === 0 && deltaFila !== 0;
    const esDiagonal = Math.abs(deltaFila) === Math.abs(deltaCol) && deltaFila !== 0;
    
    if (esHorizontal || esVertical || esDiagonal) {
      const pasos = Math.max(Math.abs(deltaFila), Math.abs(deltaCol));
      const dirFila = deltaFila === 0 ? 0 : deltaFila / Math.abs(deltaFila);
      const dirCol = deltaCol === 0 ? 0 : deltaCol / Math.abs(deltaCol);
      
      const nuevaSeleccion = [];
      for (let i = 0; i <= pasos; i++) {
        nuevaSeleccion.push({
          fila: celdaInicio.fila + dirFila * i,
          col: celdaInicio.col + dirCol * i
        });
      }
      setCeldasSeleccionadas(nuevaSeleccion);
    }
  };

  const finalizarSeleccion = () => {
    if (!seleccionando || !juegoActivo || mostrandoSolucion) return;
    
    setSeleccionando(false);
    
    if (celdasSeleccionadas.length > 0 && juegoDatos) {
      const palabraSeleccionada = celdasSeleccionadas
        .map(({ fila, col }) => juegoDatos.tablero[fila][col])
        .join('');
      
      if (juegoDatos.palabras.includes(palabraSeleccionada)) {
        if (!palabrasEncontradas.includes(palabraSeleccionada)) {
          const nuevasCeldas = [...celdasPalabrasEncontradas];
          celdasSeleccionadas.forEach(celda => {
            nuevasCeldas.push(`${celda.fila}-${celda.col}`);
          });
          setCeldasPalabrasEncontradas(nuevasCeldas);
          
          enviarComando('ENCONTRAR', { palabra: palabraSeleccionada });
          mostrarEstado(`¡Encontraste: ${palabraSeleccionada}!`, 'success');
        } else {
          mostrarEstado('Ya encontraste esa palabra', 'info');
        }
      }
    }
    
    setCeldasSeleccionadas([]);
    setCeldaInicio(null);
  };

  const esCeldaSeleccionada = (fila, col) => {
    return celdasSeleccionadas.some(c => c.fila === fila && c.col === col);
  };

  const esCeldaEncontrada = (fila, col) => {
    return celdasPalabrasEncontradas.includes(`${fila}-${col}`);
  };

  const esCeldaSolucion = (fila, col) => {
    return celdasSolucion.includes(`${fila}-${col}`);
  };

  const calcularProgreso = () => {
    if (!juegoDatos) return 0;
    const total = juegoDatos.total_palabras;
    const encontradas = palabrasEncontradas.length;
    return Math.round((encontradas / total) * 100);
  };

  const progreso = calcularProgreso();

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
        <div className="progress-bar" style={{ width: `${progreso}%` }}>
          {juegoDatos ? `${palabrasEncontradas.length}/${juegoDatos.total_palabras} - ${progreso}%` : '0%'}
        </div>
      </div>

      {estado.visible && (
        <div className={`status ${estado.tipo}`}>
          {estado.mensaje}
        </div>
      )}

      <div className="game-area">
        <div className="board-container">
          {juegoDatos && juegoDatos.tablero ? (
            <div 
              className="board"
              style={{
                gridTemplateColumns: `repeat(${juegoDatos.tablero.length}, 35px)`
              }}
              onMouseUp={finalizarSeleccion}
              onMouseLeave={finalizarSeleccion}
            >
              {juegoDatos.tablero.map((fila, i) =>
                fila.map((letra, j) => {
                  const clases = ['cell'];
                  const esSolucion = esCeldaSolucion(i, j);
                  const esEncontrada = esCeldaEncontrada(i, j);
                  const esSeleccionada = esCeldaSeleccionada(i, j);
                  
                  if (esSolucion) {
                    clases.push('solution');
                  } else if (esEncontrada) {
                    clases.push('found');
                  } else if (esSeleccionada) {
                    clases.push('selecting');
                  }
                  
                  return (
                    <div
                      key={`${i}-${j}`}
                      className={clases.join(' ')}
                      onMouseDown={(e) => iniciarSeleccion(e, i, j)}
                      onMouseEnter={() => continuarSeleccion(i, j)}
                    >
                      {letra}
                    </div>
                  );
                })
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
            {juegoDatos && juegoDatos.palabras ? (
              juegoDatos.palabras.map((palabra, index) => {
                const estaEncontrada = palabrasEncontradas.includes(palabra);
                return (
                  <li 
                    key={`word-${palabra}-${index}`}
                    className={`word-item ${estaEncontrada ? 'found' : ''}`}
                    data-palabra={palabra}
                  >
                    {palabra}
                  </li>
                );
              })
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