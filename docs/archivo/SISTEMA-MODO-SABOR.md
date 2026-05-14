# Documentacion Maestra: Modo Sabor

Este documento resume la arquitectura actual del sistema despues de la limpieza de bot, Ollama e integraciones de IA.

## 1. Arquitectura actual

- Backend API
  - Puerto: `3001`
  - Tecnologia: Node.js + Express + SQLite
  - Base de datos: `server/data/modosabor.db`
- Frontend admin
  - Puerto: `5173`
  - Tecnologia: React + Vite + Tailwind
- Lanzador
  - Archivo: `ModoSabor.pyw`
  - Inicia solo backend y frontend

## 2. Base de datos

La inicializacion principal sigue en `server/db.js`.

- crea tablas faltantes
- completa configuracion por defecto
- limpia claves obsoletas de integraciones viejas

## 3. Arranque

Secuencia actual:

1. Backend API
2. Frontend admin

## 4. Notas

- El proyecto ya no tiene flujo activo de automatizacion conversacional, Ollama ni proveedores de IA.
- Si mas adelante se reconstruye esa capa, conviene hacerlo como modulo aparte y no mezclarlo otra vez con la configuracion base.
