import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { FarmShiftLayout } from '../layouts/FarmShiftLayout';

const user = { role: 'ROLE_FARM_OWNER', name: 'Owner' };
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user }) }));
vi.mock('../context/NotificationContext', () => ({
    useNotification: () => ({ alerts: [], unreadCount: 0 }),
}));
vi.mock('../components/AIChatbot/AIChatbot', () => ({ AIChatbot: () => null }));
vi.mock('../components/GlobalSearch/GlobalSearch', () => ({ GlobalSearch: () => null }));

afterEach(() => vi.restoreAllMocks());

it('links the environment shortcut to the selected barn IoT detail', () => {
    render(<MemoryRouter><FarmShiftLayout showShortcuts environmentHref="/iot?barn=11" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Môi trường/ })).toHaveAttribute('href', '/iot?barn=11');
});

it.each([
    { position: 'bottom', itemTop: 690, itemBottom: 750, expected: 530 },
    { position: 'top', itemTop: 120, itemBottom: 180, expected: 240 },
    { position: 'above the scroll limit', itemTop: -200, itemBottom: -140, expected: 0 },
])('smoothly reveals context for an active item near $position after a page remount', ({ itemTop, itemBottom, expected }) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
        if (this.classList.contains('farmshift-sidebar')) return { top: 100, bottom: 800 };
        if (this.tagName === 'LI') return { height: 60 };
        return this.getAttribute('href') === '/areas'
            ? { top: itemTop, bottom: itemBottom }
            : { top: 350, bottom: 410 };
    });
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1500);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(700);
    const scrollTo = vi.fn();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo });
    try {
        const { container } = render(<MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
                <Route path="/dashboard" element={<FarmShiftLayout key="dashboard" />} />
                <Route path="/areas" element={<FarmShiftLayout key="areas" />} />
            </Routes>
        </MemoryRouter>);
        const sidebar = container.querySelector('.farmshift-sidebar');
        sidebar.scrollTop = 400;
        fireEvent.scroll(sidebar);
        expect(scrollTo).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('link', { name: 'Khu nuôi' }));
        expect(scrollTo).toHaveBeenCalledWith({ top: expected, behavior: 'smooth' });
    } finally {
        delete HTMLElement.prototype.scrollTo;
        vi.unstubAllGlobals();
    }
});

it('preserves sidebar scroll when navigation mounts a different page layout', () => {
    const { container } = render(<MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
            <Route path="/dashboard" element={<FarmShiftLayout key="dashboard" pageTitle="Dashboard" />} />
            <Route path="/areas" element={<FarmShiftLayout key="areas" pageTitle="Areas" />} />
        </Routes>
    </MemoryRouter>);
    const sidebar = container.querySelector('.farmshift-sidebar');
    sidebar.scrollTop = 420;
    fireEvent.scroll(sidebar);
    fireEvent.click(screen.getByRole('link', { name: 'Khu nuôi' }));
    const nextSidebar = container.querySelector('.farmshift-sidebar');
    expect(nextSidebar).not.toBe(sidebar);
    expect(nextSidebar.scrollTop).toBe(420);

    nextSidebar.scrollTop = 180;
    fireEvent.scroll(nextSidebar);
    fireEvent.click(screen.getByRole('link', { name: 'Bảng tin' }));
    expect(container.querySelector('.farmshift-sidebar').scrollTop).toBe(180);
});
