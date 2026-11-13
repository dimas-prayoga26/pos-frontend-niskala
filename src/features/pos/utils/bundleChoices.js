// Kategori Promo packages can hold choices: N menus of a category that the
// cashier picks when ordering. Each cart line of such a package keeps one
// select per portion (bundleSlots) and the picked menus of one package
// (bundleChoices: [{ menuItemId, name, quantity }]).

// "Cafe Latte, 2× Aren Latte"
export const bundleChoicesText = (choices = []) =>
  (choices || [])
    .map((choice) =>
      Number(choice.quantity) > 1 ? `${choice.quantity}× ${choice.name}` : choice.name
    )
    .join(", ");

// The package's contents for its card: "1× Kentang · 2× Pilihan Coffee".
export const bundleContentsText = (item) =>
  [
    ...(item?.bundleItems || []).map((line) => `${line.quantity}× ${line.name}`),
    ...(item?.bundleChoices || []).map(
      (choice) => `${choice.quantity}× Pilihan ${choice.categoryName}`
    ),
  ].join(" · ");

// The selects of a package with choices:
// [{ categoryId, categoryName, options: [{ id, name, group }], picks: [menuItemId | null] }]
// with one pick per portion. Options are the ordinary menus the POS lists:
// the choice's own menus (menuItemIds) wherever they sit now, else every
// menu of its category; group is the category they sit in.
export const buildBundleSlots = (item, catalog) =>
  (item.bundleChoices || []).map((choice) => {
    const offered = new Set((choice.menuItemIds || []).map(Number));
    const sources = offered.size
      ? catalog
      : catalog.filter((category) => Number(category.id) === Number(choice.categoryId));
    const candidates = sources.flatMap((category) =>
      category.items
        .filter((option) => !offered.size || offered.has(Number(option.id)))
        .map((option) => ({ option, group: category.name }))
    );

    const options = candidates
      .filter(({ option }) => !option.bundleItems?.length && !option.bundleChoices?.length)
      .map(({ option, group }) => ({ id: option.id, name: option.name, group }));

    return {
      categoryId: choice.categoryId,
      categoryName: choice.categoryName,
      options,
      // A choice of one menu has nothing to pick: it starts picked.
      picks: Array.from({ length: Number(choice.quantity) || 0 }, () =>
        options.length === 1 ? Number(options[0].id) || null : null
      ),
    };
  });

// The options of a choice's select per category, in their order:
// [{ group, options }]; one group when they all sit in one category.
export const groupBundleOptions = (options = []) =>
  options.reduce((groups, option) => {
    const last = groups[groups.length - 1];
    if (last && last.group === option.group) last.options.push(option);
    else groups.push({ group: option.group, options: [option] });
    return groups;
  }, []);

// The picked menus of the selects, counted per menu.
export const pickedBundleChoices = (slots = []) => {
  const byMenu = new Map();

  slots.forEach((slot) =>
    slot.picks.forEach((menuItemId) => {
      if (!menuItemId) return;

      const current = byMenu.get(menuItemId);
      if (current) {
        current.quantity += 1;
        return;
      }
      const option = slot.options.find((candidate) => Number(candidate.id) === Number(menuItemId));
      byMenu.set(menuItemId, { menuItemId, name: option?.name || "", quantity: 1 });
    })
  );

  return [...byMenu.values()];
};

export const hasMissingBundlePicks = (cart = []) =>
  cart.some((line) => (line.bundleSlots || []).some((slot) => slot.picks.some((pick) => !pick)));

export const isBundleChoiceLineOf = (cartLineId, cartItemId) =>
  String(cartLineId).startsWith(`${cartItemId}~`);

// Every package with choices gets its own cart line: "<cartItemId>~<n>".
export const nextBundleLineId = (cart, cartItemId) => {
  const used = cart
    .filter((line) => isBundleChoiceLineOf(line.id, cartItemId))
    .map((line) => Number(String(line.id).split("~").pop()) || 0);

  return `${cartItemId}~${Math.max(0, ...used) + 1}`;
};
