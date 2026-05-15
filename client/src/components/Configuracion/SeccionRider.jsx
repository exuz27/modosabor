import React from 'react';
import { Smartphone, Palette, Type, Image as ImageIcon, X } from 'lucide-react';
import { SectionCard, InputField } from './ConfigComponents.jsx';
import api from '../../lib/api.js';
import toast from 'react-hot-toast';

export default function SeccionRider({ config, f, setConfig }) {
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('imagen', file);
    try {
      const res = await api.post('/productos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setConfig(prev => ({ ...prev, rider_app_logo: res.url }));
      toast.success('Logo de App cargado');
    } catch {
      toast.error('Error al subir logo');
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-8">
      <div className="sticky top-[84px] z-10 mb-8 flex items-center justify-between rounded-[28px] border border-gray-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-100 flex items-center justify-center">
            <Smartphone className="text-blue-600" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">App del Repartidor</h2>
            <p className="text-sm text-gray-500">Personaliza la apariencia y textos de la interfaz para riders.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <SectionCard icon={Type} tone="blue" title="Identidad" subtitle="Nombre y mensajes de bienvenida">
            <div className="space-y-6">
              <InputField label="Nombre de la App" {...f('rider_app_nombre')} placeholder="Ej: Modo Sabor Delivery" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mensaje de Bienvenida</label>
                <textarea
                  {...f('rider_app_bienvenida')}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Texto corto que vera el rider al iniciar..."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={Palette} tone="blue" title="Colores Visuales" subtitle="Paleta de la interfaz movil">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Color Primario</label>
                <div className="flex gap-2">
                  <input type="color" {...f('rider_app_color_primario')} className="h-11 w-12 rounded-lg border border-gray-300 p-1" />
                  <input type="text" {...f('rider_app_color_primario')} className="flex-1 rounded-xl border border-gray-300 px-3 text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Color Secundario</label>
                <div className="flex gap-2">
                  <input type="color" {...f('rider_app_color_secundario')} className="h-11 w-12 rounded-lg border border-gray-300 p-1" />
                  <input type="text" {...f('rider_app_color_secundario')} className="flex-1 rounded-xl border border-gray-300 px-3 text-sm" />
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-8">
          <SectionCard icon={ImageIcon} tone="blue" title="Logo y Marca" subtitle="Imagen principal de la App">
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50">
              {config.rider_app_logo ? (
                <div className="relative group">
                  <img src={config.rider_app_logo} alt="Rider App Logo" className="h-32 w-32 object-contain rounded-2xl bg-white p-2 shadow-sm" />
                  <button 
                    onClick={() => setConfig(p => ({ ...p, rider_app_logo: '' }))}
                    className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="h-32 w-32 rounded-2xl bg-gray-200 flex items-center justify-center text-gray-400">
                  <ImageIcon size={40} />
                </div>
              )}
              
              <label className="mt-6 cursor-pointer rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700">
                <span>Cambiar Logo</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
              </label>
              <p className="mt-3 text-[10px] text-gray-400 uppercase font-black">PNG o JPG recomendado (512x512)</p>
            </div>
          </SectionCard>

          <div className="rounded-[32px] bg-blue-600 p-8 text-white shadow-xl shadow-blue-200">
            <h4 className="text-lg font-black uppercase tracking-tight mb-2">Vista Previa</h4>
            <p className="text-xs text-blue-100 mb-6">Como se vera la App en el movil:</p>
            <div className="w-full aspect-[9/16] max-w-[200px] mx-auto rounded-[32px] border-8 border-gray-900 bg-white overflow-hidden shadow-2xl">
               <div className="h-12 flex items-center px-4" style={{ backgroundColor: config.rider_app_color_primario || '#5D87FF' }}>
                  <div className="h-2 w-12 rounded-full bg-white/20"></div>
               </div>
               <div className="p-4 space-y-4">
                  <div className="h-10 w-full rounded-xl bg-gray-100 flex items-center justify-center">
                    <img src={config.rider_app_logo} className="h-6 object-contain opacity-50" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-3/4 rounded-full bg-gray-200"></div>
                    <div className="h-3 w-1/2 rounded-full bg-gray-100"></div>
                  </div>
                  <div className="mt-auto pt-10">
                    <div className="h-10 w-full rounded-xl shadow-md" style={{ backgroundColor: config.rider_app_color_primario || '#5D87FF' }}></div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
