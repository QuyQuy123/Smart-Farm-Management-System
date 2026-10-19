import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import styles from './AreaTabs.module.css';

/**
 * Horizontal navigation for the area pages (replaces the old sidebar submenu, so it still works with the
 * sidebar collapsed): area list, all barns, then one tab per area with its barn count.
 * active: 'areas' | 'barns' | an area id.
 */
export function AreaTabs({ areas, active }) {
  const nav = useRef(null);
  // Keep the current tab visible when the bar scrolls horizontally on narrow screens.
  useEffect(() => {
    const current = nav.current?.querySelector('[aria-current="page"]');
    if (current && nav.current.scrollWidth > nav.current.clientWidth) {
      nav.current.scrollLeft = current.offsetLeft - (nav.current.clientWidth - current.offsetWidth) / 2;
    }
  }, [active, areas.length]);
  const tab = (key, to, label, count) => {
    const current = String(active) === String(key);
    return <Link key={key} to={to} className={`${styles.tab} ${current ? styles.active : ''}`} aria-current={current ? 'page' : undefined}>
      {label}{count != null && <span className={styles.count}>{count}</span>}
    </Link>;
  };
  return <nav ref={nav} className={styles.tabs} aria-label="Điều hướng khu nuôi">
    {tab('areas', '/areas', 'Danh sách khu nuôi')}
    {tab('barns', '/barns', 'Tất cả chuồng')}
    {areas.length > 0 && <span className={styles.divider} aria-hidden="true" />}
    {areas.map(area => tab(area.id, `/areas/${area.id}`, area.name, area.barnCount))}
  </nav>;
}
