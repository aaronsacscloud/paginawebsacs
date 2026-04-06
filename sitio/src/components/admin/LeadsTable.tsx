import { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';

interface Lead {
  id: string;
  timestamp: string;
  nombre: string;
  empresa: string;
  giro: string;
  sucursales: string;
  whatsapp: string;
  email: string;
  paso: string;
  plan: string;
}

export default function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'timestamp', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');

  const loadLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/get-leads');
      const data = await res.json();
      setLeads(data.leads || []);
    } catch {
      setLeads([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadLeads(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const totalPaso1 = leads.filter(l => l.paso?.includes('Paso 1')).length;
  const totalRegistrado = leads.filter(l => l.paso?.includes('Registro')).length;
  const totalHoy = leads.filter(l => l.timestamp?.startsWith(today)).length;

  const columns = useMemo<ColumnDef<Lead>[]>(() => [
    {
      accessorKey: 'timestamp',
      header: 'Fecha',
      cell: ({ getValue }) => {
        const d = new Date(getValue() as string);
        return <span style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
          {d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}{' '}
          <span style={{ color: '#aaa' }}>{d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
        </span>;
      },
    },
    {
      accessorKey: 'nombre',
      header: 'Nombre',
      cell: ({ getValue }) => <strong>{getValue() as string}</strong>,
    },
    { accessorKey: 'empresa', header: 'Empresa' },
    { accessorKey: 'giro', header: 'Giro' },
    { accessorKey: 'sucursales', header: 'Suc.' },
    {
      accessorKey: 'whatsapp',
      header: 'WhatsApp',
      cell: ({ getValue }) => {
        const wa = getValue() as string;
        if (!wa) return '-';
        const num = wa.replace(/\D/g, '');
        return <a href={`https://wa.me/52${num}`} target="_blank" rel="noopener" style={{ color: '#2AB5A0', fontWeight: 600, textDecoration: 'none' }}>{wa}</a>;
      },
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ getValue }) => {
        const email = getValue() as string;
        return email ? <a href={`mailto:${email}`} style={{ color: '#4B7BE5', textDecoration: 'none' }}>{email}</a> : '-';
      },
    },
    {
      accessorKey: 'paso',
      header: 'Estado',
      cell: ({ getValue }) => {
        const paso = getValue() as string;
        const done = paso?.includes('Registro');
        return <span style={{
          fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
          background: done ? '#e8f5e9' : '#fff3e0',
          color: done ? '#2e7d32' : '#e65100',
        }}>{done ? 'Registrado' : 'Pendiente'}</span>;
      },
    },
    { accessorKey: 'plan', header: 'Plan' },
  ], []);

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb', padding: '0 24px 48px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0', borderBottom: '1px solid #eee', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: "'Clash Display', sans-serif", fontSize: '1.5rem', fontWeight: 700 }}>Sacs</span>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#4B7BE5', background: 'rgba(75,123,229,0.08)', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>CRM</span>
        </div>
        <button onClick={loadLeads} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 600, color: '#666', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer' }}>
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total', value: leads.length, color: '#4B7BE5' },
          { label: 'Pendientes', value: totalPaso1, color: '#E8A838' },
          { label: 'Registrados', value: totalRegistrado, color: '#2AB5A0' },
          { label: 'Hoy', value: totalHoy, color: '#6C5CE7' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#fff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#999', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Buscar por nombre, empresa, email..."
          style={{ width: '100%', maxWidth: '400px', padding: '10px 16px', fontSize: '0.875rem', border: '1px solid #e0e0e0', borderRadius: '8px', outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      style={{
                        padding: '12px 16px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 600,
                        textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#aaa',
                        background: '#fafafa', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
                        borderBottom: '1px solid #f0f0f0',
                      }}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getIsSorted() === 'asc' ? ' ↑' : h.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: '48px', color: '#bbb' }}>Cargando...</td></tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: '48px', color: '#bbb' }}>No hay leads</td></tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f8f8f8' }}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} style={{ padding: '12px 16px', color: '#555' }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
