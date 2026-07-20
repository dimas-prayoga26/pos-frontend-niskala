import butterChicken from '../assets/images/butter-chicken-4.jpg';
import palakPaneer from '../assets/images/Saag-Paneer-1.jpg';
import biryani from '../assets/images/hyderabadibiryani.jpg';
import masalaDosa from '../assets/images/masala-dosa.jpg';
import choleBhature from '../assets/images/chole-bhature.jpg';
import rajmaChawal from '../assets/images/rajma-chawal-1.jpg';
import paneerTikka from '../assets/images/paneer-tika.webp';
import gulabJamun from '../assets/images/gulab-jamun.webp';
import pooriSabji from '../assets/images/poori-sabji.webp';
import roganJosh from '../assets/images/rogan-josh.jpg';
import { color } from 'framer-motion';

export const bestSellingMenus = [
  {
    id: 1,
    image: butterChicken,
    name: "Chicken Katsu Rice Bowl",
    numberOfOrders: 250,
    type: "Makanan",
  },
  {
    id: 2,
    image: palakPaneer,
    name: "Ayam Geprek Rice Bowl",
    numberOfOrders: 190,
    type: "Makanan",
  },
  {
    id: 3,
    image: biryani,
    name: "Beef Teriyaki Rice Bowl",
    numberOfOrders: 300,
    type: "Makanan",
  },
  {
    id: 4,
    image: masalaDosa,
    name: "Indomie Goreng Telur",
    numberOfOrders: 220,
    type: "Makanan",
  },
  {
    id: 5,
    image: choleBhature,
    name: "Kentang Goreng",
    numberOfOrders: 270,
    type: "Makanan",
  },
  {
    id: 6,
    image: rajmaChawal,
    name: "Americano",
    numberOfOrders: 180,
    type: "Minuman",
  },
  {
    id: 7,
    image: paneerTikka,
    name: "Cappuccino",
    numberOfOrders: 210,
    type: "Minuman",
  },
  {
    id: 8,
    image: gulabJamun,
    name: "Latte",
    numberOfOrders: 310,
    type: "Minuman",
  },
  {
    id: 9,
    image: pooriSabji,
    name: "Matcha",
    numberOfOrders: 140,
    type: "Minuman",
  },
  {
    id: 10,
    image: roganJosh,
    name: "Thai Tea",
    numberOfOrders: 160,
    type: "Minuman",
  },
];

export const cateringPackages = [
  {
    id: 1,
    image: pooriSabji,
    name: "Paket 20K / Box",
    price: 20000,
  },
  {
    id: 2,
    image: rajmaChawal,
    name: "Paket 28K / Box",
    price: 28000,
  },
  {
    id: 3,
    image: biryani,
    name: "Paket 30K / Box",
    price: 30000,
  },
  {
    id: 4,
    image: paneerTikka,
    name: "Paket 35K / Box",
    price: 35000,
  },
];


export const startersItem = [
    {
      id: 1,
      name: "Paneer Tikka",
      price: 250,
      category: "Vegetarian"
    },
    {
      id: 2,
      name: "Chicken Tikka",
      price: 300,
      category: "Non-Vegetarian"
    },
    {
      id: 3,
      name: "Tandoori Chicken",
      price: 350,
      category: "Non-Vegetarian"
    },
    {
      id: 4,
      name: "Samosa",
      price: 100,
      category: "Vegetarian"
    },
    {
      id: 5,
      name: "Aloo Tikki",
      price: 120,
      category: "Vegetarian"
    },
    {
      id: 6,
      name: "Hara Bhara Kebab",
      price: 220,
      category: "Vegetarian"
    }
  ];
  
export const mainCourse = [
  {
    id: 1,
    name: "Butter Chicken",
    price: 400,
    category: "Non-Vegetarian"
  },
  {
    id: 2,
    name: "Paneer Butter Masala",
    price: 350,
    category: "Vegetarian"
  },
  {
    id: 3,
    name: "Chicken Biryani",
    price: 450,
    category: "Non-Vegetarian"
  },
  {
    id: 4,
    name: "Dal Makhani",
    price: 180,
    category: "Vegetarian"
  },
  {
    id: 5,
    name: "Kadai Paneer",
    price: 300,
    category: "Vegetarian"
  },
  {
    id: 6,
    name: "Rogan Josh",
    price: 500,
    category: "Non-Vegetarian"
  }
];

export const beverages = [
  {
    id: 1,
    name: "Masala Chai",
    price: 50,
    category: "Hot"
  },
  {
    id: 2,
    name: "Lemon Soda",
    price: 80,
    category: "Cold"
  },
  {
    id: 3,
    name: "Mango Lassi",
    price: 120,
    category: "Cold"
  },
  {
    id: 4,
    name: "Cold Coffee",
    price: 150,
    category: "Cold"
  },
  {
    id: 5,
    name: "Fresh Lime Water",
    price: 60,
    category: "Cold"
  },
  {
    id: 6,
    name: "Iced Tea",
    price: 100,
    category: "Cold"
  }
];

export const soups = [
  {
    id: 1,
    name: "Tomato Soup",
    price: 120,
    category: "Vegetarian"
  },
  {
    id: 2,
    name: "Sweet Corn Soup",
    price: 130,
    category: "Vegetarian"
  },
  {
    id: 3,
    name: "Hot & Sour Soup",
    price: 140,
    category: "Vegetarian"
  },
  {
    id: 4,
    name: "Chicken Clear Soup",
    price: 160,
    category: "Non-Vegetarian"
  },
  {
    id: 5,
    name: "Mushroom Soup",
    price: 150,
    category: "Vegetarian"
  },
  {
    id: 6,
    name: "Lemon Coriander Soup",
    price: 110,
    category: "Vegetarian"
  }
];

export const desserts = [
  {
    id: 1,
    name: "Gulab Jamun",
    price: 100,
    category: "Vegetarian"
  },
  {
    id: 2,
    name: "Kulfi",
    price: 150,
    category: "Vegetarian"
  },
  {
    id: 3,
    name: "Chocolate Lava Cake",
    price: 250,
    category: "Vegetarian"
  },
  {
    id: 4,
    name: "Ras Malai",
    price: 180,
    category: "Vegetarian"
  }
];

export const pizzas = [
  {
    id: 1,
    name: "Margherita Pizza",
    price: 350,
    category: "Vegetarian"
  },
  {
    id: 2,
    name: "Veg Supreme Pizza",
    price: 400,
    category: "Vegetarian"
  },
  {
    id: 3,
    name: "Pepperoni Pizza",
    price: 450,
    category: "Non-Vegetarian"
  }
];

export const alcoholicDrinks = [
  {
    id: 1,
    name: "Beer",
    price: 200,
    category: "Alcoholic"
  },
  {
    id: 2,
    name: "Whiskey",
    price: 500,
    category: "Alcoholic"
  },
  {
    id: 3,
    name: "Vodka",
    price: 450,
    category: "Alcoholic"
  },
  {
    id: 4,
    name: "Rum",
    price: 350,
    category: "Alcoholic"
  },
  {
    id: 5,
    name: "Tequila",
    price: 600,
    category: "Alcoholic"
  },
  {
    id: 6,
    name: "Cocktail",
    price: 400,
    category: "Alcoholic"
  }
];

export const salads = [
  {
    id: 1,
    name: "Caesar Salad",
    price: 200,
    category: "Vegetarian"
  },
  {
    id: 2,
    name: "Greek Salad",
    price: 250,
    category: "Vegetarian"
  },
  {
    id: 3,
    name: "Fruit Salad",
    price: 150,
    category: "Vegetarian"
  },
  {
    id: 4,
    name: "Chicken Salad",
    price: 300,
    category: "Non-Vegetarian"
  },
  {
    id: 5,
    name: "Tuna Salad",
    price: 350,
  
  }
];


export const menus = [
  { id: 1, name: "Starters", icon: "🍲", items: startersItem },
  { id: 2, name: "Main Course", icon: "🍛", items: mainCourse },
  { id: 3, name: "Beverages", icon: "🍹", items: beverages },
  { id: 4, name: "Soups", icon: "🍜", items: soups },
  { id: 5, name: "Desserts", icon: "🍰", items: desserts },
  { id: 6, name: "Pizzas", icon: "🍕", items: pizzas },
  { id: 7, name: "Alcoholic Drinks", icon: "🍺", items: alcoholicDrinks },
  { id: 8, name: "Salads", icon: "🥗", items: salads }
]

export const orders = [
  {
    id: "101",
    customer: "Amrit Raj",
    status: "Completed",
    dateTime: "January 18, 2025 08:32 PM",
    items: 8,
    total: 250.0,
  },
  {
    id: "102",
    customer: "John Doe",
    status: "In Progress",
    dateTime: "January 18, 2025 08:45 PM",
    items: 5,
    total: 180.0,
  },
  {
    id: "103",
    customer: "Emma Smith",
    status: "Completed",
    dateTime: "January 18, 2025 09:00 PM",
    items: 3,
    total: 120.0,
  },
  {
    id: "104",
    customer: "Chris Brown",
    status: "In Progress",
    dateTime: "January 18, 2025 09:15 PM",
    items: 6,
    total: 220.0,
  },
];
