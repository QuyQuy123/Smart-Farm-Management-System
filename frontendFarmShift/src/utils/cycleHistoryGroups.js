/**
 * Gộp các lứa nuôi đã kết thúc có quan hệ tách đàn (chia sẻ `batchGroupKey`) thành dòng tổng hợp cả lô nhập,
 * tránh cộng trùng số con đã tách giữa chuồng nguồn và chuồng đích.
 */
export function groupClosedCycles(rows, canFinance = true) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const byKey = new Map();
  for (const row of rows) {
    if (!row.batchGroupKey) continue;
    if (!byKey.has(row.batchGroupKey)) byKey.set(row.batchGroupKey, []);
    byKey.get(row.batchGroupKey).push(row);
  }

  const emittedGroups = new Set();
  const output = [];
  for (const row of rows) {
    const key = row.batchGroupKey;
    const members = key ? byKey.get(key) : null;
    if (!key || !members || members.length < 2) {
      output.push({ ...row, isGroupRow: false, rowKey: String(row.cycleId) });
      continue;
    }
    if (emittedGroups.has(key)) continue;
    emittedGroups.add(key);

    const sortedMembers = [...members].sort((a, b) => {
      const da = a.startDate || '';
      const db = b.startDate || '';
      if (da !== db) return da.localeCompare(db);
      return Number(a.cycleId) - Number(b.cycleId);
    });

    const memberIds = new Set(sortedMembers.map(m => m.cycleId));
    let internalTransferQty = 0;
    let hasExplicitLinks = false;
    for (const m of sortedMembers) {
      if (Array.isArray(m.transferLinks) && m.transferLinks.length > 0) {
        hasExplicitLinks = true;
        for (const link of m.transferLinks) {
          if (link.direction === 'OUT' && memberIds.has(link.cycleId)) {
            internalTransferQty += Number(link.quantity || 0);
          }
        }
      }
    }
    const rawTotalIn = sortedMembers.reduce((sum, m) => sum + Number(m.totalIn || 0), 0);
    if (!hasExplicitLinks) {
      internalTransferQty = Math.min(rawTotalIn, sortedMembers.reduce((sum, m) => sum + Number(m.transferredOut || 0), 0));
    }

    const totalIn = Math.max(0, rawTotalIn - internalTransferQty);
    const harvestedQuantity = sortedMembers.reduce((sum, m) => sum + Number(m.harvestedQuantity || 0), 0);
    const deaths = sortedMembers.reduce((sum, m) => sum + Number(m.deaths || 0), 0);
    const culls = sortedMembers.reduce((sum, m) => sum + Number(m.culls || 0), 0);
    const survivalRate = totalIn > 0
      ? Math.round(((Math.max(0, totalIn - deaths - culls) * 100) / totalIn) * 100) / 100
      : null;

    const feedKg = sortedMembers.reduce((sum, m) => sum + Number(m.feedKg || 0), 0);
    const weightGainKg = sortedMembers.reduce((sum, m) => sum + Number(m.weightGainKg || 0), 0);
    const fcr = weightGainKg > 0 && feedKg > 0
      ? Math.round((feedKg / weightGainKg) * 100) / 100
      : null;

    const harvestedWeightKg = sortedMembers.reduce((sum, m) => sum + Number(m.harvestedWeightKg || 0), 0);
    const avgHarvestWeightKg = harvestedQuantity > 0
      ? Math.round((harvestedWeightKg / harvestedQuantity) * 1000) / 1000
      : null;

    const diseaseCount = sortedMembers.reduce((sum, m) => sum + Number(m.diseaseCount || 0), 0);
    const totalDiseaseMedicineCost = canFinance
      ? sortedMembers.reduce((sum, m) => sum + Number(m.totalDiseaseMedicineCost || 0), 0)
      : null;
    const totalCost = canFinance
      ? sortedMembers.reduce((sum, m) => sum + Number(m.totalCost || 0), 0)
      : null;
    const revenue = canFinance
      ? sortedMembers.reduce((sum, m) => sum + Number(m.revenue || 0), 0)
      : null;
    const profit = canFinance
      ? sortedMembers.reduce((sum, m) => sum + Number(m.profit || 0), 0)
      : null;
    const costPerKg = canFinance && harvestedWeightKg > 0
      ? Math.round(totalCost / harvestedWeightKg)
      : null;

    const barnNames = [...new Set(sortedMembers.map(m => m.barnName).filter(Boolean))];
    const areaNames = [...new Set(sortedMembers.map(m => m.areaName).filter(Boolean))];
    const breeds = [...new Set(sortedMembers.flatMap(m => m.breeds || []).filter(Boolean))];
    const startDates = sortedMembers.map(m => m.startDate).filter(Boolean).sort();
    const endDates = sortedMembers.map(m => m.endDate).filter(Boolean).sort();

    output.push({
      isGroupRow: true,
      rowKey: `group-${key}`,
      batchGroupKey: key,
      members: sortedMembers,
      barnNames,
      areaNames,
      breeds,
      startDate: startDates[0] || null,
      endDate: endDates[endDates.length - 1] || null,
      durationDays: Math.max(...sortedMembers.map(m => Number(m.durationDays || 0))),
      totalIn,
      harvestedQuantity,
      deaths,
      culls,
      survivalRate,
      feedKg,
      weightGainKg,
      fcr,
      harvestedWeightKg,
      avgHarvestWeightKg,
      diseaseCount,
      totalDiseaseMedicineCost,
      totalCost,
      revenue,
      profit,
      costPerKg,
    });
  }
  return output;
}

export function flattenGroupedRows(groupedItems, expandedKeys) {
  if (!Array.isArray(groupedItems)) return [];
  const expanded = expandedKeys instanceof Set ? expandedKeys : new Set();
  const flat = [];
  for (const item of groupedItems) {
    flat.push(item);
    if (item.isGroupRow && expanded.has(item.batchGroupKey)) {
      for (const member of item.members) {
        flat.push({
          ...member,
          isGroupRow: false,
          isGroupChild: true,
          rowKey: `child-${member.cycleId}`,
        });
      }
    }
  }
  return flat;
}
