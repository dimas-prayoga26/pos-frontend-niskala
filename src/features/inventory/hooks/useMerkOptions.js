import { useMemo, useState } from "react";

const NO_MERKS = [];
const draftMerkId = (name) => `draft:${name.toLowerCase()}`;

// Merk of purchase lines: the saved ones (GET /api/shopping/merks), those a
// draft nota came back with, and names typed in the form ("draft:" ids), which
// the server creates with the nota. payloadOf turns a line's merkId into what
// the API takes: { merkId }, { merkName } for a new one, or {} for none.
// optionsFor(kindKey, itemId): the merk bought for that barang first
// (rawItemIds / supplyItemIds of each merk), then the rest.
const useMerkOptions = (merks = NO_MERKS) => {
  const [extras, setExtras] = useState([]);
  const options = useMemo(
    () =>
      Array.from(
        new Map([...merks, ...extras].map((merk) => [String(merk.id), { id: merk.id, text: merk.name }])).values()
      ),
    [merks, extras]
  );

  // Cached per barang, so each select keeps the same options between renders.
  const optionsFor = useMemo(() => {
    const cache = new Map();
    return (kindKey, itemId) => {
      const cacheKey = `${kindKey}:${itemId || ""}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      const key = kindKey === "supply" ? "supplyItemIds" : "rawItemIds";
      const ids = new Set(
        itemId
          ? merks.filter((merk) => merk[key]?.some((id) => String(id) === String(itemId))).map((merk) => String(merk.id))
          : []
      );
      const bought = options.filter((option) => ids.has(String(option.id)));
      const others = options.filter((option) => !ids.has(String(option.id)));
      const grouped = bought.length
        ? [{ text: "Pernah dibeli", children: bought }, ...(others.length ? [{ text: "Merk lain", children: others }] : [])]
        : options;
      cache.set(cacheKey, grouped);
      return grouped;
    };
  }, [merks, options]);

  const create = (name) => {
    const existing = options.find((option) => option.text.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const created = { id: draftMerkId(name), name, isNew: true };
    setExtras((current) => [...current.filter((merk) => merk.id !== created.id), created]);
    return { id: created.id, text: name };
  };

  // Saved merk of loaded lines ({ merkId, merkName }), in case the list has not caught up.
  const remember = (lines) => {
    const known = lines.filter((line) => line.merkId).map((line) => ({ id: line.merkId, name: line.merkName || "" }));
    setExtras(known);
  };

  const payloadOf = (merkId) => {
    if (!merkId) return {};
    const created = extras.find((merk) => merk.isNew && merk.id === merkId);
    return created ? { merkName: created.name } : { merkId };
  };

  return { options, optionsFor, create, remember, payloadOf, reset: () => setExtras([]) };
};

export default useMerkOptions;
