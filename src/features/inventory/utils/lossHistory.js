// Used by the Riwayat Kerugian (wastes) panel: rows listed under their
// business day, and period totals of the days' costs.

export const formatDay = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// rows (newest first) per business day (dateOf(row)), each day with its
// total from the server (all its rows, not only the ones listed).
export const groupByDay = (rows, dailyTotals, dateOf) => {
  const totalByDate = new Map(dailyTotals.map((day) => [day.date, day.cost]));
  const days = [];

  for (const row of rows) {
    if (days[days.length - 1]?.date !== dateOf(row)) days.push({ date: dateOf(row), rows: [] });
    days[days.length - 1].rows.push(row);
  }

  return days.map((day) => ({
    ...day,
    cost: totalByDate.get(day.date) ?? day.rows.reduce((total, row) => total + row.cost, 0),
  }));
};

// Cost of today, this week (from Monday) and this month, summed from the
// days' totals. Dates are business days ("YYYY-MM-DD", Asia/Jakarta).
export const periodTotals = (dailyTotals, today) => {
  const monday = new Date(`${today}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const sumFrom = (from) =>
    dailyTotals
      .filter((day) => day.date >= from && day.date <= today)
      .reduce((total, day) => total + day.cost, 0);

  return [
    { label: "Hari ini", cost: sumFrom(today) },
    { label: "Minggu ini", cost: sumFrom(monday.toISOString().slice(0, 10)) },
    { label: "Bulan ini", cost: sumFrom(`${today.slice(0, 7)}-01`) },
  ];
};

// Loss in red, a selisih lebih (negative) in green.
export const costClassName = (cost) => (cost < 0 ? "text-green-400" : "text-red-400");

// The newest row (highest id) of each item, the one that can be undone.
export const latestIdByItem = (rows) => {
  const latest = new Map();
  for (const row of rows) {
    if (row.itemId && row.id > (latest.get(row.itemId) || 0)) latest.set(row.itemId, row.id);
  }
  return latest;
};
