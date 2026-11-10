import { describe, expect, it } from "vitest";
import { rankBestSellers } from "./bestSeller";

describe("rankBestSellers", () => {
  const menuItems = [
    { id: 1, name: "Butterscotch Latte", imagePath: "/uploads/menu/latte.png", category: { name: "White Coffee", bestSellerGroup: "Minuman" } },
    { id: 2, name: "Rice Bowl Ayam", category: { name: "Rice Bowl", bestSellerGroup: "Makanan" } },
    { id: 3, name: "Roti Kukus Coklat", category: { name: "Roti", bestSellerGroup: "Snack" } },
    { id: 4, name: "Paket 20K / Box", category: { name: "Catering", bestSellerGroup: null } },
    // Renamed from "Matcha" after it was sold.
    { id: 56, name: "Matcha Latte", category: { name: "Matcha Series", bestSellerGroup: "Minuman" } },
    // The Hot copy of Butterscotch Latte.
    { id: 7, name: "Butterscotch Latte", category: { name: "Hot White Coffee", bestSellerGroup: "Minuman" } },
  ];
  const orders = [
    { items: [{ menuItemId: 1, name: "Butterscotch Latte", quantity: 2 }, { name: "roti kukus coklat ", quantity: 1 }, { menuItemId: 4, name: "Paket 20K / Box", quantity: 5 }] },
    { items: [{ menuItemId: 2, name: "Rice Bowl Ayam", quantity: 3 }, { menuItemId: 7, name: "Butterscotch Latte", quantity: 2 }, { name: "Menu Lama", quantity: 9 }] },
    { items: [{ menuItemId: 56, name: "Matcha", quantity: 2 }, { menuItemId: 56, name: "Matcha Latte", quantity: 1 }] },
  ];

  it("ranks sold menus by quantity under their category's tab, leaving out menus in no tab", () => {
    expect(rankBestSellers(orders, menuItems).map((dish) => [dish.name, dish.group, dish.numberOfOrders])).toEqual([
      ["Butterscotch Latte", "Minuman", 4],
      ["Rice Bowl Ayam", "Makanan", 3],
      ["Matcha Latte", "Minuman", 3],
      ["Roti Kukus Coklat", "Snack", 1],
    ]);
    expect(rankBestSellers(orders, menuItems)[0]).toMatchObject({ image: "/uploads/menu/latte.png" });
  });
});
