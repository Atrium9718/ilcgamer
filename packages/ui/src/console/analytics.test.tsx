import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsView, type AnalyticsViewProps } from './AnalyticsView.tsx';
import { ANALYTICS_DEMO } from './fixtures.ts';

function props(over: Partial<AnalyticsViewProps> = {}): AnalyticsViewProps {
  return {
    tab: 'ruta-a',
    onTabChange: vi.fn(),
    days: 30,
    onDaysChange: vi.fn(),
    data: ANALYTICS_DEMO,
    referralSettings: { enabled: false, referrerPoints: 0, referrerXp: 0, dailyCap: 5, weeklyCap: 20, attributionWindowDays: 7 },
    onReferralSettingsChange: vi.fn(),
    onSaveReferralSettings: vi.fn(),
    referralSummary: { attributed: 40, rewardedByClaim: 12, rewardedByMission: 9, capped: 2 },
    ...over,
  };
}

describe('AnalyticsView (Guía Técnica §10.2)', () => {
  it('Ruta A muestra activaciones y puntos por SKU y campaña, y aclara que una activación no prueba consumo', () => {
    render(<AnalyticsView {...props()} />);
    expect(screen.getAllByText('1.240').length).toBeGreaterThan(0);
    const sku = screen.getByRole('table', { name: 'Activaciones por producto' });
    expect(within(sku).getByText('Ron Viejo de Caldas 8 años (RVC-8)')).toBeInTheDocument();
    expect(screen.getByText(/no prueba consumo/)).toBeInTheDocument();
  });

  it('Ruta B muestra la finalización y aclara que el XP no se convierte en puntos', () => {
    render(<AnalyticsView {...props({ tab: 'ruta-b' })} />);
    expect(screen.getByText('70 %')).toBeInTheDocument();
    expect(screen.getByText(/nunca se convierte en Puntos ILC/)).toBeInTheDocument();
  });

  it('la vista ejecutiva muestra ambas rutas lado a lado sin una puntuación única', () => {
    render(<AnalyticsView {...props({ tab: 'ejecutiva' })} />);
    expect(screen.getByRole('heading', { name: 'Ruta A · Comercial' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ruta B · Experiencia' })).toBeInTheDocument();
    expect(screen.getByText(/sin reducirlos a una sola puntuación/)).toBeInTheDocument();
  });

  it('cambia de período y de tablero', async () => {
    const p = props();
    render(<AnalyticsView {...p} />);
    await userEvent.selectOptions(screen.getByLabelText('Período'), '7');
    expect(p.onDaysChange).toHaveBeenCalledWith(7);
    await userEvent.click(screen.getByRole('tab', { name: 'Operación' }));
    expect(p.onTabChange).toHaveBeenCalledWith('operacion');
  });

  it('las reglas de referidos nacen apagadas y se editan con errores por campo', async () => {
    const p = props({ tab: 'referidos', fieldErrors: { dailyCap: ['El tope diario no puede superar al semanal'] } });
    render(<AnalyticsView {...p} />);
    expect(screen.getByRole('switch', { name: 'Bonificar a quien invita' })).not.toBeChecked();
    expect(screen.getByText(/El tope diario no puede superar/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Bonificar a quien invita' }));
    expect(p.onReferralSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar reglas' }));
    expect(p.onSaveReferralSettings).toHaveBeenCalled();
  });
});
